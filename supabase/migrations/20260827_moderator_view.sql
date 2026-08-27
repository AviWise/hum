-- Moderation you can do from a phone, without handing anyone a master key.
--
-- The tempting version is "moderators can read direct messages". That is a
-- standing power over every private conversation in the app, held by whoever
-- still has the login next year. The version here is narrower and enforced by
-- the database: a moderator can read a thread ONLY while an unreviewed report
-- is open on it. Clear the report and the access ends with it.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);
alter table public.admins enable row level security;

-- you can learn whether YOU are one; you cannot enumerate the others
drop policy if exists "admins: see your own row" on public.admins;
create policy "admins: see your own row" on public.admins
  for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policies: admin is granted off-client, like everything
-- else that decides an outcome

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (select 1 from public.admins where user_id = auth.uid())
$fn$;

-- a thread is open to a moderator exactly as long as a report on it is
create or replace function public.thread_under_report(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.dm_reports r where r.thread_id = t and r.reviewed_at is null
  )
$fn$;

drop policy if exists "dm_threads: moderators see reported ones" on public.dm_threads;
create policy "dm_threads: moderators see reported ones" on public.dm_threads
  for select to authenticated using (public.is_admin() and public.thread_under_report(id));

drop policy if exists "dm: moderators read reported threads" on public.dm_messages;
create policy "dm: moderators read reported threads" on public.dm_messages
  for select to authenticated
  using (public.is_admin() and public.thread_under_report(thread_id));

drop policy if exists "dm_reports: moderators read the queue" on public.dm_reports;
create policy "dm_reports: moderators read the queue" on public.dm_reports
  for select to authenticated using (public.is_admin());

drop policy if exists "dm_reports: moderators close them" on public.dm_reports;
create policy "dm_reports: moderators close them" on public.dm_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- closing a report is the only field a moderator may touch on it
create or replace function public.dm_reports_update_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null then
    new.thread_id := old.thread_id;
    new.reporter_id := old.reporter_id;
    new.note := old.note;
    new.created_at := old.created_at;
  end if;
  return new;
end $fn$;

drop trigger if exists dm_reports_update_guard on public.dm_reports;
create trigger dm_reports_update_guard before update on public.dm_reports
  for each row execute function public.dm_reports_update_guard();

-- rooms are public, so the read was never the issue; burying is
drop policy if exists "room: moderators bury" on public.room_messages;
create policy "room: moderators bury" on public.room_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "room reports: moderators read the queue" on public.room_reports;
create policy "room reports: moderators read the queue" on public.room_reports
  for select to authenticated using (public.is_admin());

-- a moderator may take a message down; nobody may put words in someone's mouth
create or replace function public.room_update_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null then
    new.body := old.body;
    new.author_id := old.author_id;
    new.username := old.username;
    new.spot_id := old.spot_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $fn$;

drop trigger if exists room_update_guard on public.room_messages;
create trigger room_update_guard before update on public.room_messages
  for each row execute function public.room_update_guard();

-- suspension becomes something a moderator can apply in the app, and still
-- something nobody can lift for themselves
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
  end if;
  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;

drop policy if exists "profiles: moderators suspend" on public.profiles;
create policy "profiles: moderators suspend" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
