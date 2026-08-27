-- out. — direct messages, with the safety kit built in rather than bolted on.
--
-- This app publishes where people are, right now. A private channel on top of
-- that is the highest-risk surface here, so the shape is a message REQUEST, not
-- an inbox: a stranger gets exactly one message through, and then silence until
-- the recipient answers. Replying is accepting. Ignoring costs nothing and
-- says nothing. Blocking is silent — the blocked party sees no error that
-- tells them they were blocked.
--
-- Text only in v1. Images are the single worst harassment vector in any DM
-- product and leaving them out costs one column.

-- ---------------------------------------------------------------- blocks ----
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;

-- You can see who YOU blocked. You cannot see who blocked you — that is what
-- makes blocking silent, and silence is what keeps it safe to use.
drop policy if exists "blocks: see your own" on public.blocks;
create policy "blocks: see your own" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks: block for yourself" on public.blocks;
create policy "blocks: block for yourself" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "blocks: unblock your own" on public.blocks;
create policy "blocks: unblock your own" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$fn$;

-- --------------------------------------------------------------- threads ----
-- lo/hi is the ordered pair, so one conversation exists per pair of people no
-- matter who starts it.
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  lo uuid not null references auth.users(id) on delete cascade,
  hi uuid not null references auth.users(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (lo, hi),
  constraint ordered_pair check (lo < hi)
);
create index if not exists dm_threads_lo_idx on public.dm_threads (lo);
create index if not exists dm_threads_hi_idx on public.dm_threads (hi);
alter table public.dm_threads enable row level security;

-- SECURITY DEFINER so the policy does not query the table it protects — that
-- recursion is a runtime error, and an error looks exactly like a policy that
-- correctly returned nothing.
create or replace function public.in_thread(t uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.dm_threads
    where id = t and auth.uid() in (lo, hi)
  )
$fn$;

drop policy if exists "dm_threads: yours only" on public.dm_threads;
create policy "dm_threads: yours only" on public.dm_threads
  for select to authenticated using (auth.uid() in (lo, hi));
drop policy if exists "dm_threads: start one" on public.dm_threads;
create policy "dm_threads: start one" on public.dm_threads
  for insert to authenticated with check (started_by = auth.uid() and auth.uid() in (lo, hi));
drop policy if exists "dm_threads: answer one" on public.dm_threads;
create policy "dm_threads: answer one" on public.dm_threads
  for update to authenticated using (auth.uid() in (lo, hi)) with check (auth.uid() in (lo, hi));

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
    new.accepted_at := null;   -- nobody starts a thread pre-accepted
  else
    -- the only thing either party may change is acceptance, and only the
    -- person who did NOT start it can grant it
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

-- -------------------------------------------------------------- messages ----
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint dm_body_length check (char_length(btrim(body)) between 1 and 500)
);
create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at);
alter table public.dm_messages enable row level security;

drop policy if exists "dm: read your own threads" on public.dm_messages;
create policy "dm: read your own threads" on public.dm_messages
  for select to authenticated using (removed_at is null and public.in_thread(thread_id));
drop policy if exists "dm: write in your own threads" on public.dm_messages;
create policy "dm: write in your own threads" on public.dm_messages
  for insert to authenticated with check (author_id = auth.uid() and public.in_thread(thread_id));
drop policy if exists "dm: unsend your own" on public.dm_messages;
create policy "dm: unsend your own" on public.dm_messages
  for delete to authenticated using (author_id = auth.uid());

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
      -- a stranger gets one message through, then nothing until they answer
      select count(*) into sent from public.dm_messages where thread_id = t.id and author_id = me;
      if sent >= 1 then raise exception 'wait until they answer'; end if;
    else
      -- answering IS accepting; there is no separate button to press
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

-- --------------------------------------------------------------- reports ----
-- A DM report cannot auto-hide anything the way a public post can — nobody
-- else can see it to corroborate. It queues for a person, and blocking is the
-- remedy the reporter gets immediately.
create table if not exists public.dm_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.dm_reports enable row level security;
drop policy if exists "dm_reports: file your own" on public.dm_reports;
create policy "dm_reports: file your own" on public.dm_reports
  for insert to authenticated with check (reporter_id = auth.uid() and public.in_thread(thread_id));

create or replace function public.dm_reports_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.reporter_id := coalesce(auth.uid(), new.reporter_id);
  if new.reporter_id is null then raise exception 'sign in first'; end if;
  new.reviewed_at := null;
  return new;
end $fn$;

drop trigger if exists dm_reports_guard on public.dm_reports;
create trigger dm_reports_guard before insert on public.dm_reports
  for each row execute function public.dm_reports_guard();

alter publication supabase_realtime add table public.dm_messages;
