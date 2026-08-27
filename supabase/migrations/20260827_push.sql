-- Notifications: one good reason to come back, not ten bad ones.
--
-- The rule this table exists to keep is quiet_hours + a cap. A going-out app
-- that buzzes at 3am about a bar is uninstalled by Tuesday, and the only
-- notification worth sending is one that answers the question the app answers:
-- something is happening near you, now, that you would want to know about.
create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  sent_today int not null default 0,
  day date not null default current_date,
  failed_at timestamptz
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;

-- your own subscriptions, nobody else's: an endpoint is a capability to buzz
-- someone's phone, so the list of them is not public
drop policy if exists "push: your own" on public.push_subs;
create policy "push: your own" on public.push_subs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push: subscribe yourself" on public.push_subs;
create policy "push: subscribe yourself" on public.push_subs
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "push: unsubscribe yourself" on public.push_subs;
create policy "push: unsubscribe yourself" on public.push_subs
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.push_subs_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  if new.user_id is null then raise exception 'sign in first'; end if;
  new.sent_today := 0;
  new.failed_at := null;
  return new;
end $fn$;

drop trigger if exists push_subs_guard on public.push_subs;
create trigger push_subs_guard before insert on public.push_subs
  for each row execute function public.push_subs_guard();

-- what was sent, so a person is never told the same thing twice
create table if not exists public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, key)
);
alter table public.push_log enable row level security;
-- no policies at all: this is the sender's ledger, not the client's
