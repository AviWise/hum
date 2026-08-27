-- out. — 18+ to message privately. The map stays open to anyone.
--
-- Proportionate on purpose: the map is a published thing about public places,
-- and walling it off protects nobody. The private channel is the risk, so the
-- gate goes there.
--
-- This is a self-declared gate, and it is worth being honest about what that
-- buys: not a technical barrier — a determined 15-year-old types a different
-- year — but the ability to say we do not knowingly run a private messaging
-- service for minors, and grounds to remove an account when we learn otherwise.
-- Face estimation and ID checks would buy more assurance at a privacy cost
-- this app has no business imposing on students.

-- Birth dates do NOT go on profiles: that table is world-readable by policy,
-- and adding a column there would publish everyone's birthday.
create table if not exists public.age_checks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  declared_at timestamptz not null default now(),
  constraint birth_date_plausible check (
    birth_date > date '1900-01-01' and birth_date < current_date
  )
);
alter table public.age_checks enable row level security;

drop policy if exists "age: read your own" on public.age_checks;
create policy "age: read your own" on public.age_checks
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "age: declare once" on public.age_checks;
create policy "age: declare once" on public.age_checks
  for insert to authenticated with check (user_id = auth.uid());
-- No update policy: a birth date you can edit is not a declaration, it is a
-- toggle. Someone who mistypes needs a human, which is the correct amount of
-- friction for the thing that decides whether minors can be messaged.

create or replace function public.age_checks_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.user_id is null then raise exception 'sign in first'; end if;
  new.declared_at := now();
  return new;
end $fn$;

drop trigger if exists age_checks_guard on public.age_checks;
create trigger age_checks_guard before insert on public.age_checks
  for each row execute function public.age_checks_guard();

create or replace function public.is_adult(u uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.age_checks
    where user_id = u and birth_date <= current_date - interval '18 years'
  )
$fn$;

-- ------------------------------------------------------------------ DMs ----
-- Both sides must be adults. The refusal deliberately reuses the wording used
-- when someone is blocked: telling a sender "that person is a minor" would
-- leak something about a stranger that they did not choose to publish.
create or replace function public.dm_threads_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if me is null then raise exception 'sign in first'; end if;
    new.started_by := me;
    if me not in (new.lo, new.hi) then raise exception 'that is not your conversation'; end if;
    if public.is_blocked(new.lo, new.hi) then raise exception 'you cannot message this person'; end if;
    if not public.is_adult(me) then raise exception 'messaging is 18+'; end if;
    if not public.is_adult(case when me = new.lo then new.hi else new.lo end) then
      raise exception 'you cannot message this person';
    end if;
    new.accepted_at := null;
  else
    new.lo := old.lo; new.hi := old.hi;
    new.started_by := old.started_by; new.created_at := old.created_at;
    if old.accepted_at is not null then
      new.accepted_at := old.accepted_at;
    elsif new.accepted_at is not null and me = old.started_by then
      raise exception 'they have to accept';
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists dm_threads_guard on public.dm_threads;
create trigger dm_threads_guard before insert or update on public.dm_threads
  for each row execute function public.dm_threads_guard();

create or replace function public.dm_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  t public.dm_threads%rowtype;
  sent int;
  recent int;
begin
  new.author_id := me;
  if me is null then raise exception 'sign in first'; end if;
  select * into t from public.dm_threads where id = new.thread_id;
  if t.id is null or me not in (t.lo, t.hi) then raise exception 'that is not your conversation'; end if;
  if public.is_blocked(t.lo, t.hi) then raise exception 'you cannot message this person'; end if;
  -- checked per message, not just at thread creation: a thread started before
  -- this rule existed does not get to keep running under the old one
  if not public.is_adult(me) then raise exception 'messaging is 18+'; end if;
  if not public.is_adult(case when me = t.lo then t.hi else t.lo end) then
    raise exception 'you cannot message this person';
  end if;

  new.body := btrim(new.body);
  new.removed_at := null;
  new.created_at := now();
  if char_length(new.body) < 1 or char_length(new.body) > 500 then
    raise exception 'keep it between 1 and 500 characters';
  end if;
  if new.body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|ly|gg|xyz|co)\M)' then
    raise exception 'no links in a first conversation';
  end if;
  if new.body ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
    raise exception 'not in a message';
  end if;

  if t.accepted_at is null then
    if me = t.started_by then
      select count(*) into sent from public.dm_messages where thread_id = t.id and author_id = me;
      if sent >= 1 then raise exception 'wait until they answer'; end if;
    else
      update public.dm_threads set accepted_at = now() where id = t.id;
    end if;
  end if;

  select count(*) into recent from public.dm_messages
    where author_id = me and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'slow down a second'; end if;

  return new;
end $fn$;

drop trigger if exists dm_guard on public.dm_messages;
create trigger dm_guard before insert on public.dm_messages
  for each row execute function public.dm_guard();
