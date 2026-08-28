-- F6: profiles.full_name was world-readable, and about to start being populated.
--
-- ORDERING: 'zc' so it sorts after 20260828_reserved_at_every_door.sql, which
-- last defined both functions redefined here.
--
-- The register called this LATENT because full_name is empty in every row, and
-- that was still true when checked on 2026-08-28: 0 of 10 rows. Latent is not
-- the same as harmless. The signup form collects a name, handle_new_user writes
-- it, and ProfilePage, ProfileSheet, MessagesSheet and GroupsPanel all render
-- it. The fuse is the Google consent screen: publishing it (which is on the list
-- for the 50-student push) makes Google hand us full_name in raw_user_meta_data
-- on every OAuth signup, and this table would begin publishing real students'
-- legal names to logged-out strangers with no code change and no review. That is
-- exactly the "no code change" the finding warned about, and the change that
-- arms it is a checkbox in a Google console, not a commit.
--
-- Avi (2026-08-28), asked how far to go: "whatever you think is best."
--
-- So: hum. becomes pseudonymous by construction. @username is the identity the
-- interface already leads with everywhere; a real name was a second, weaker
-- identifier that nobody had asked for and nobody could remove once OAuth
-- started filling it in.
--
-- The column is KEPT, not dropped. Nothing is lost by keeping it (it holds no
-- data), and a drop would be the one step of this that cannot be walked back.

-- 1. Stop writing it. handle_new_user no longer reads full_name from signup
--    metadata at all, so neither the form nor Google can populate it.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  base text;
  candidate text;
  n int := 0;
  dob date;
begin
  base := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  base := regexp_replace(base, '[^a-z0-9_.]', '', 'g');
  if char_length(base) < 3 then base := 'hum' || substr(md5(new.id::text), 1, 6); end if;
  base := substr(base, 1, 20);

  if public.is_reserved(base) then
    base := 'student' || substr(md5(new.id::text), 1, 6);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := substr(base, 1, 17) || n::text;
  end loop;

  -- full_name is deliberately absent from this insert. See F6.
  insert into public.profiles (id, username)
    values (new.id, candidate)
    on conflict (id) do nothing;

  begin
    dob := (new.raw_user_meta_data->>'birth_date')::date;
  exception when others then dob := null;
  end;
  if dob is not null and dob > date '1900-01-01' and dob < current_date then
    insert into public.age_checks (user_id, birth_date) values (new.id, dob)
      on conflict (user_id) do nothing;
  end if;

  return new;
end $fn$;

-- 2. Freeze it on edit, so the column cannot be filled in later through an
--    ordinary profile update. The reserved-display-name check that used to live
--    here is gone with it: a value that can never change can never be set to an
--    impersonating one, and leaving the check would have implied full_name was
--    still a thing a person could write.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.full_name := old.full_name;

  if auth.uid() is not null then
    new.kind := old.kind;
    new.school_domain := old.school_domain;
    new.claimed_at := old.claimed_at;
    if not public.is_admin() or new.id = auth.uid() then
      new.suspended_until := old.suspended_until;
      new.suspended_reason := old.suspended_reason;
    end if;

    if new.username is distinct from old.username
       and public.is_reserved(new.username) then
      raise exception 'That name is reserved.' using errcode = '42501';
    end if;
  end if;

  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;

-- 3. Nothing to clear (0 rows populated as of 2026-08-28), but assert that
--    rather than assume it — a silent no-op looks identical to a real one.
do $$
declare leftover int;
begin
  update public.profiles set full_name = null where full_name is not null;
  get diagnostics leftover = row_count;
  raise notice 'F6: cleared % existing full_name value(s)', leftover;
end $$;
