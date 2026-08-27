-- out. — university groups, part one: an org is a profile with a different kind.
--
-- The promise "we don't disclose private university events" currently lives in
-- regexes in scripts/watch-sources.mjs, which guess whether a scraped listing
-- is public. A guess is the wrong place to keep that promise permanently. Here
-- it becomes structural: the org declares its own audience, and the database
-- enforces it.
--
-- This migration ships the 'city' tier only. A 'school' post is accepted and
-- stored, but is readable by nobody except its author until .edu verification
-- exists — so the promise holds from the first day the column does, rather
-- than from the day the UI eventually respects it.

-- ------------------------------------------------------------- profiles ----
alter table public.profiles add column if not exists kind text not null default 'person';
alter table public.profiles add column if not exists school_domain text;
alter table public.profiles add column if not exists claimed_at timestamptz;
alter table public.profiles add column if not exists bio text;

alter table public.profiles drop constraint if exists profiles_kind;
alter table public.profiles add constraint profiles_kind
  check (kind in ('person', 'org'));

-- an org belongs to a school; that is what makes it a university group rather
-- than just an account with a logo
alter table public.profiles drop constraint if exists org_names_its_school;
alter table public.profiles add constraint org_names_its_school
  check (kind <> 'org' or school_domain is not null);

alter table public.profiles drop constraint if exists school_domain_shape;
alter table public.profiles add constraint school_domain_shape
  check (school_domain is null or school_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$');

alter table public.profiles drop constraint if exists bio_length;
alter table public.profiles add constraint bio_length
  check (bio is null or char_length(bio) <= 160);

-- "profiles: owner edits own" lets any account update its own row, so without
-- this an account could simply set kind='org' on itself and skip review
-- entirely. Becoming an org is not self-service.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if current_user in ('authenticated', 'anon') then
    new.kind := old.kind;
    new.school_domain := old.school_domain;
    new.claimed_at := old.claimed_at;
  end if;
  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------- posts ----
alter table public.posts add column if not exists audience text not null default 'city';
alter table public.posts drop constraint if exists posts_audience;
alter table public.posts add constraint posts_audience
  check (audience in ('city', 'school'));

-- A person account has no campus to post to, so their posts are public by
-- construction; only an org can declare 'school'. Runs on update too, or an
-- author could re-label a post after the fact.
create or replace function public.posts_audience_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  poster_kind text;
begin
  -- auth.uid() rather than new.author_id, so this does not depend on firing
  -- after posts_guard (which is what sets author_id)
  select kind into poster_kind from public.profiles
    where id = coalesce(auth.uid(), new.author_id);
  if poster_kind is distinct from 'org' then
    new.audience := 'city';
  elsif new.audience not in ('city', 'school') then
    new.audience := 'city';
  end if;
  return new;
end $fn$;

drop trigger if exists posts_audience_guard on public.posts;
create trigger posts_audience_guard before insert or update on public.posts
  for each row execute function public.posts_audience_guard();

-- The read policy is where the promise is actually kept. Note this replaces
-- "posts: read the record" from 20260826_durable_history.sql — history stays
-- readable, but only for the public tier.
drop policy if exists "posts: read the record" on public.posts;
drop policy if exists "posts: read the public record" on public.posts;
create policy "posts: read the public record" on public.posts
  for select using (removed_at is null and audience = 'city');

-- Policies are OR'd, so an author still sees their own campus posts. Nobody
-- else does, including other members of the same school — that tier does not
-- open until verification lands.
drop policy if exists "posts: authors read their own" on public.posts;
create policy "posts: authors read their own" on public.posts
  for select to authenticated using (removed_at is null and author_id = auth.uid());

-- ----------------------------------------------------------- org_claims ----
-- Claiming is a request, not an act. Nothing here grants anything: approval
-- writes to profiles from the service role, the same way contests and
-- trophies are decided off-client.
create table if not exists public.org_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_name text not null check (char_length(trim(org_name)) between 2 and 60),
  school_domain text not null check (school_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  evidence text check (evidence is null or char_length(evidence) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved boolean
);
-- one open claim per account: a queue, not a spam vector
create unique index if not exists org_claims_one_open
  on public.org_claims (user_id) where reviewed_at is null;

alter table public.org_claims enable row level security;

drop policy if exists "org_claims: file your own" on public.org_claims;
create policy "org_claims: file your own" on public.org_claims
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "org_claims: read your own" on public.org_claims;
create policy "org_claims: read your own" on public.org_claims
  for select to authenticated using (user_id = auth.uid());
-- deliberately no update/delete policy: a claimant cannot review themselves

create or replace function public.org_claims_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.user_id is null then
    raise exception 'sign in first';
  end if;
  new.reviewed_at := null;
  new.approved := null;
  new.org_name := trim(new.org_name);
  new.school_domain := lower(trim(new.school_domain));
  return new;
end $fn$;

drop trigger if exists org_claims_guard on public.org_claims;
create trigger org_claims_guard before insert on public.org_claims
  for each row execute function public.org_claims_guard();
