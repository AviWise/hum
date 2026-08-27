-- Ask at signup, not only at first message.
--
-- The just-in-time gate had a launch-day flaw: messaging needs BOTH people to
-- be known adults, so until someone happened to open messaging themselves,
-- nobody could message them — and the refusal is deliberately the same generic
-- line used for a block, so it read as "this person blocked you" rather than
-- "this person hasn't answered a question yet". Collecting the date at signup
-- means the declaration exists for everyone from the first day.
--
-- Runs in handle_new_user rather than from the client because a new account may
-- have no session yet (email confirmation), and age_checks can only be written
-- by its owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  base text;
  candidate text;
  n int := 0;
  dob date;
begin
  base := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  base := regexp_replace(base, '[^a-z0-9_.]', '', 'g');
  if char_length(base) < 3 then base := 'out' || substr(md5(new.id::text), 1, 6); end if;
  base := substr(base, 1, 20);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := substr(base, 1, 17) || n::text;
  end loop;
  insert into public.profiles (id, username, full_name)
    values (new.id, candidate, nullif(new.raw_user_meta_data->>'full_name', ''))
    on conflict (id) do nothing;

  -- a date of birth given at signup becomes the declaration; anything absent
  -- or nonsensical is simply not recorded, and the just-in-time gate asks later
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
