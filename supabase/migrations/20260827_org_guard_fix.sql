-- profiles_guard never fired.
--
-- It gated on `current_user in ('authenticated','anon')`, which is true when
-- PostgREST sets the role — but the function is SECURITY DEFINER, and inside
-- one of those current_user is the function's OWNER (postgres), never the
-- caller's role. So the gate was false for every real request and the freeze
-- was dead code: any account could set kind='org' on itself.
--
-- auth.uid() reads the request's JWT instead, which SECURITY DEFINER does not
-- disturb. A client session always has one; the service role and direct SQL —
-- the only places approval should ever happen — do not.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null then
    new.kind := old.kind;
    new.school_domain := old.school_domain;
    new.claimed_at := old.claimed_at;
  end if;
  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;
