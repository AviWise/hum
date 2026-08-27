-- out. — university groups, part three: a group is not an account.
--
-- Until now an org WAS a profile: approving a claim converted the filer's
-- account into the group, so a student who claimed from their own profile lost
-- it, and a group run by three people had to share one login. Both are wrong,
-- and both get much worse to fix once real orgs exist.
--
-- So: orgs become their own thing, people join them, and a post carries two
-- identities — author_id, the human who is accountable for it, and org_id, the
-- group it speaks for. The public sees the group. Moderation sees the person.

-- ---------------------------------------------------------------- schools ----
-- The demo org lives on a school that does not exist, on purpose: a
-- placeholder group must not be attachable to a real university. That needs a
-- schools row to satisfy the foreign key, and a way to keep it out of every
-- list a student ever sees.
alter table public.schools add column if not exists demo boolean not null default false;
insert into public.schools (domain, name, sort, demo)
  values ('demo.edu', 'Sample University', 9999, true)
  on conflict (domain) do update set demo = true, sort = 9999;

-- ------------------------------------------------------------------ orgs ----
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  name text not null,
  school_domain text not null references public.schools(domain),
  bio text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint org_handle_format check (handle ~ '^[a-z0-9_.]{3,30}$'),
  constraint org_name_length check (char_length(trim(name)) between 2 and 60),
  constraint org_bio_length check (bio is null or char_length(bio) <= 160)
);
alter table public.orgs enable row level security;
drop policy if exists "orgs: public read" on public.orgs;
create policy "orgs: public read" on public.orgs for select using (true);
-- no insert/update/delete for clients: an org exists because a claim was
-- reviewed, never because someone asked nicely

-- ----------------------------------------------------------- org_members ----
create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members (user_id);
alter table public.org_members enable row level security;

-- Who runs a group is the group's business, not the city's. Members see the
-- roster; nobody else does.
drop policy if exists "org_members: members see the roster" on public.org_members;
create policy "org_members: members see the roster" on public.org_members
  for select to authenticated using (
    exists (select 1 from public.org_members m
            where m.org_id = org_members.org_id and m.user_id = auth.uid())
  );
-- no insert/update/delete: adding people runs through the review tool, so a
-- compromised account cannot quietly add itself to a group

-- ----------------------------------------------------------------- posts ----
alter table public.posts add column if not exists org_id uuid references public.orgs(id) on delete set null;
create index if not exists posts_org_idx on public.posts (org_id) where org_id is not null;

create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.org_members m where m.org_id = org and m.user_id = auth.uid()
  )
$fn$;

-- Posting as a group requires being in it, and the campus tier belongs to
-- groups — a person posting as themselves has no campus to post to.
create or replace function public.posts_audience_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  poster uuid := coalesce(auth.uid(), new.author_id);
  org_handle text;
begin
  if new.org_id is not null then
    -- membership is checked against the real caller, not anything they sent
    if poster is null or not exists (
      select 1 from public.org_members m where m.org_id = new.org_id and m.user_id = poster
    ) then
      raise exception 'you are not in that group';
    end if;
    -- the byline is the group's; author_id still records who actually posted
    select handle into org_handle from public.orgs where id = new.org_id;
    new.username := org_handle;
  else
    new.audience := 'city';
  end if;

  if new.audience not in ('city', 'school') then
    new.audience := 'city';
  end if;
  return new;
end $fn$;

drop trigger if exists posts_audience_guard on public.posts;
create trigger posts_audience_guard before insert or update on public.posts
  for each row execute function public.posts_audience_guard();

-- A campus post reaches verified students of the ORG's school. Same rule as
-- before, sourced from the org rather than from the author's profile.
drop policy if exists "posts: campus posts reach verified classmates" on public.posts;
create policy "posts: campus posts reach verified classmates" on public.posts
  for select to authenticated using (
    removed_at is null
    and audience = 'school'
    and public.verified_at((select o.school_domain from public.orgs o where o.id = posts.org_id))
  );

-- ------------------------------------------------------- migrate the demo ----
-- The demo org was a profile with kind='org'. Move it across, keep its posts,
-- and hand the profile back its personhood.
do $$
declare
  demo_uid uuid;
  new_org uuid;
begin
  select id into demo_uid from public.profiles where username = 'out.demo.nightowls';
  if demo_uid is null then return; end if;

  insert into public.orgs (handle, name, school_domain, bio, claimed_at)
  values ('nightowls', 'Night Owls Film Society', 'demo.edu',
          'screenings that start when the reading stops', now())
  on conflict (handle) do update set name = excluded.name
  returning id into new_org;

  insert into public.org_members (org_id, user_id, role)
  values (new_org, demo_uid, 'owner')
  on conflict do nothing;

  update public.posts set org_id = new_org, username = 'nightowls'
  where author_id = demo_uid;

  update public.profiles set kind = 'person', school_domain = null, claimed_at = null
  where id = demo_uid;
end $$;

-- profiles.kind stops deciding anything about posting. The column stays for
-- now rather than being dropped mid-flight, but nothing reads it.
