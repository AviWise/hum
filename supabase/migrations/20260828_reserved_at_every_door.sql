-- F10: reserved names were enforced at the doors nobody walks through.
--
-- ORDERING: 20260828 so it sorts after every 08-27 file, including
-- moderator_view.sql, which last defined profiles_guard, and reserved_contains.sql,
-- which defined the mode column this relies on.
--
-- The audit note said institutional names were refused "at both doors" — the
-- claim form and the orgs table. There were four, and the two that were open
-- are the two an attacker would actually use:
--
--   1. SIGNUP. handle_new_user sanitized the charset and deduped, and never
--      called is_reserved. @humsupport was free.
--   2. RENAME. profiles_guard is BEFORE UPDATE and never looked at username at
--      all, so any account could simply rename itself into a reserved handle
--      afterwards. This is the easier attack: no crafted signup metadata, just
--      an ordinary profile edit.
--
-- And a third problem of my own making: the rename migration inserted every
-- hum* token in 'exact' mode, so "hum. Support Team" tokenized to
-- humsupportteam and matched nothing. Tokens long enough to be unambiguous
-- belong in 'contains'.
--
-- With DMs live, @humsupport asking a student to "confirm your account" is the
-- whole attack. It costs one signup.

update public.reserved_handles set mode = 'contains'
 where token in ('humofficial', 'humsupport', 'humadmin', 'humteam');
-- 'hum' stays exact deliberately: in containment mode it would refuse
-- Humphrey, Humberto and anyone else whose name simply contains those three
-- letters. Short tokens are exact for exactly this reason.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  base text;
  candidate text;
  fname text;
  n int := 0;
  dob date;
begin
  base := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  base := regexp_replace(base, '[^a-z0-9_.]', '', 'g');
  if char_length(base) < 3 then base := 'hum' || substr(md5(new.id::text), 1, 6); end if;
  base := substr(base, 1, 20);

  -- the door this function never checked
  if public.is_reserved(base) then
    base := 'student' || substr(md5(new.id::text), 1, 6);
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := substr(base, 1, 17) || n::text;
  end loop;

  -- full_name is a real feature — people type it, and group requests show it —
  -- so it is kept, not dropped. But it is client-supplied text on a
  -- world-readable table, so it gets the same check and a server-side length
  -- cap; the 40-char limit was enforced only in the client until now.
  --
  -- Refused here by nulling rather than by raising: an exception inside this
  -- trigger fails the whole signup with an opaque error. On a later edit the
  -- guard below raises properly, where the person can see and fix it.
  fname := nullif(trim(substr(coalesce(new.raw_user_meta_data->>'full_name', ''), 1, 40)), '');
  if fname is not null and public.is_reserved(fname) then fname := null; end if;

  insert into public.profiles (id, username, full_name)
    values (new.id, candidate, fname)
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

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null then
    new.kind := old.kind;
    new.school_domain := old.school_domain;
    new.claimed_at := old.claimed_at;
    -- a moderator may suspend somebody else; never themselves out of trouble
    if not public.is_admin() or new.id = auth.uid() then
      new.suspended_until := old.suspended_until;
      new.suspended_reason := old.suspended_reason;
    end if;

    -- Checked only when the value actually changes, so a moderator suspending
    -- an account does not trip over a name that was already sitting there.
    if new.username is distinct from old.username
       and public.is_reserved(new.username) then
      raise exception 'That name is reserved.' using errcode = '42501';
    end if;
    if new.full_name is distinct from old.full_name
       and new.full_name is not null
       and public.is_reserved(new.full_name) then
      raise exception 'That display name is reserved.' using errcode = '42501';
    end if;
  end if;

  if new.full_name is not null then
    new.full_name := nullif(trim(substr(new.full_name, 1, 40)), '');
  end if;
  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;
