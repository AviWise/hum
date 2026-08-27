-- Read state, so an unread badge can mean something.
--
-- Without this a message arrives and nobody ever learns it did — which is the
-- actual reason messaging feels dead in an app, far more than where the entry
-- point sits.
create table if not exists public.dm_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table public.dm_reads enable row level security;

-- when YOU last looked is yours alone: read receipts are a different feature
-- with different consent, and this is not it
drop policy if exists "dm_reads: your own" on public.dm_reads;
create policy "dm_reads: your own" on public.dm_reads
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "dm_reads: mark your own" on public.dm_reads;
create policy "dm_reads: mark your own" on public.dm_reads
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "dm_reads: update your own" on public.dm_reads;
create policy "dm_reads: update your own" on public.dm_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.dm_reads_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.user_id is null then raise exception 'sign in first'; end if;
  if not public.in_thread(new.thread_id) then raise exception 'that is not your conversation'; end if;
  new.read_at := now();
  return new;
end $fn$;

drop trigger if exists dm_reads_guard on public.dm_reads;
create trigger dm_reads_guard before insert or update on public.dm_reads
  for each row execute function public.dm_reads_guard();
