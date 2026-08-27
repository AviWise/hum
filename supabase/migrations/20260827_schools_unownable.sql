-- A university is not a group, and nobody gets to own one.
--
-- Orgs are claimable because a person really does run the film society. The
-- institution itself is infrastructure — like a spot on the map — and there is
-- deliberately no flow, table or column through which anyone could come to own
-- it. What still needed closing was the side door: an org named "American
-- University" with the handle @american would be the institution as far as any
-- student could tell.

alter table public.schools add column if not exists lng double precision;
alter table public.schools add column if not exists lat double precision;

update public.schools set lng = v.lng, lat = v.lat from (values
  ('gwu.edu',        -77.0476, 38.8997),
  ('georgetown.edu', -77.0723, 38.9076),
  ('howard.edu',     -77.0197, 38.9226),
  ('american.edu',   -77.0889, 38.9375),
  ('umd.edu',        -76.9426, 38.9869),
  ('cua.edu',        -76.9986, 38.9339),
  ('gallaudet.edu',  -76.9930, 38.9068),
  ('trinitydc.edu',  -76.9977, 38.9391),
  ('udc.edu',        -77.0630, 38.9436),
  ('marymount.edu',  -77.0975, 38.8946),
  ('gmu.edu',        -77.3110, 38.8315)
) as v(domain, lng, lat) where schools.domain = v.domain;

-- names and handles no org may take, because taking one means impersonating
-- the institution rather than belonging to it
create table if not exists public.reserved_handles (
  token text primary key,
  reason text not null default 'institution'
);
alter table public.reserved_handles enable row level security;
drop policy if exists "reserved: public read" on public.reserved_handles;
create policy "reserved: public read" on public.reserved_handles for select using (true);

-- strip to letters and digits so "A.U." and "a u" collapse to the same token
create or replace function public.name_token(s text) returns text
language sql immutable set search_path = public, extensions as $fn$
  select regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]', '', 'g')
$fn$;

insert into public.reserved_handles (token, reason)
select public.name_token(t), 'institution' from (
  select unnest(array[
    -- the schools themselves, in the forms a student would recognise
    'americanuniversity', 'american', 'au', 'aueagles',
    'georgetownuniversity', 'georgetown', 'gu', 'hoyas',
    'georgewashington', 'gwu', 'gw', 'gwhatchet', 'colonials', 'revolutionaries',
    'howarduniversity', 'howard', 'hu', 'bison',
    'universityofmaryland', 'umd', 'maryland', 'terps', 'terrapins',
    'catholicuniversity', 'cua', 'catholicu',
    'gallaudetuniversity', 'gallaudet',
    'trinitywashington', 'trinitydc',
    'universityofthedistrictofcolumbia', 'udc',
    'marymountuniversity', 'marymount',
    'georgemason', 'gmu', 'mason', 'patriots',
    -- and the words that make anything sound official
    'official', 'admin', 'administration', 'staff', 'support',
    'outdc', 'out', 'outofficial', 'moderator', 'mod'
  ]) as t
) x
on conflict (token) do nothing;

create or replace function public.is_reserved(s text) returns boolean
language sql stable set search_path = public, extensions as $fn$
  select exists (select 1 from public.reserved_handles where token = public.name_token(s))
$fn$;

-- refuse at the door: a claim carrying an institutional name never reaches the
-- review queue, so it cannot be waved through on a tired evening
create or replace function public.org_claims_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.user_id is null then raise exception 'sign in first'; end if;
  new.reviewed_at := null;
  new.approved := null;
  new.org_name := trim(new.org_name);
  new.school_domain := lower(trim(new.school_domain));
  if public.is_reserved(new.org_name) then
    raise exception 'that is the university''s own name — claim your group, not the school';
  end if;
  return new;
end $fn$;

drop trigger if exists org_claims_guard on public.org_claims;
create trigger org_claims_guard before insert on public.org_claims
  for each row execute function public.org_claims_guard();

-- and the same at the only door orgs are actually created through
create or replace function public.orgs_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if public.is_reserved(new.handle) or public.is_reserved(new.name) then
    raise exception 'that name belongs to the institution, not to a group';
  end if;
  return new;
end $fn$;

drop trigger if exists orgs_guard on public.orgs;
create trigger orgs_guard before insert or update on public.orgs
  for each row execute function public.orgs_guard();
