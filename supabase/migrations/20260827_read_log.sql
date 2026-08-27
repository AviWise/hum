-- A moderator reading someone's private messages should leave a mark.
--
-- ORDERING: this must sort AFTER 20260827_moderator_view.sql, which grants the
-- read that this file takes away — an r sorts after an m. Two files defining
-- the same policy name is how "posts: campus posts reach verified classmates"
-- ended up defined twice, with the later filename silently winning.
--
-- moderator_view got the permission right: a moderator can open a reported
-- thread only while the report is open, and closing it ends the access. What
-- it had no way to express was that the read HAPPENED. The student whose
-- messages were read had no trace of it, and if a moderator went fishing
-- through reported threads there was nothing to point at afterwards.
--
-- An audit log a moderator can route around is decoration — so the direct read
-- policy on dm_messages goes away entirely and the function below becomes the
-- only door. It writes the log before it returns a single message.

create table if not exists public.admin_reads (
  id uuid primary key default gen_random_uuid(),
  -- nullable on purpose: a read through the CLI is done by whoever holds the
  -- database password, which is not an app account and should not be recorded
  -- as though it were one
  admin_id uuid references auth.users(id) on delete set null,
  via text not null default 'app' check (via in ('app', 'cli')),
  thread_id uuid not null,
  report_id uuid,
  messages int not null default 0,
  read_at timestamptz not null default now()
);
alter table public.admin_reads enable row level security;
create index if not exists admin_reads_thread on public.admin_reads (thread_id, read_at desc);

-- Moderators read the log, each other's rows included: an audit trail only one
-- person can see is not an audit trail.
--
-- Deliberately NOT readable by the two people in the thread. Showing them
-- would be the more honest design and is where this should end up, but a
-- reported harasser learning the exact minute a moderator opened the thread is
-- a tip-off during the window when it matters most. Open question, not a
-- settled answer.
drop policy if exists "admin_reads: moderators read the log" on public.admin_reads;
create policy "admin_reads: moderators read the log" on public.admin_reads
  for select to authenticated using (public.is_admin());

-- No insert policy: the function below is the only writer.
-- No update or delete policy for anybody, which is what makes it append-only.
-- A moderator who can edit the log is a moderator with no log.

create or replace function public.read_reported_thread(t uuid)
returns table (id uuid, author_id uuid, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  n int;
  r uuid;
begin
  if not public.is_admin() then
    raise exception 'not a moderator' using errcode = '42501';
  end if;
  if not public.thread_under_report(t) then
    raise exception 'no open report on that thread' using errcode = '42501';
  end if;

  select count(*) into n from public.dm_messages m where m.thread_id = t;
  select dr.id into r from public.dm_reports dr
    where dr.thread_id = t and dr.reviewed_at is null
    order by dr.created_at limit 1;

  -- before, not after: a read that errors halfway is still a read
  insert into public.admin_reads (admin_id, via, thread_id, report_id, messages)
  values (auth.uid(), 'app', t, r, n);

  return query
    select m.id, m.author_id, m.body, m.created_at
    from public.dm_messages m
    where m.thread_id = t
    order by m.created_at;
end $fn$;

revoke all on function public.read_reported_thread(uuid) from public, anon;
grant execute on function public.read_reported_thread(uuid) to authenticated;

-- the door this replaces
drop policy if exists "dm: moderators read reported threads" on public.dm_messages;
