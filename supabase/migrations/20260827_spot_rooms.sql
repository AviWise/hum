-- out. — a room per spot, not a DM inbox.
--
-- The question this app answers is "is it worth going right now", and the
-- message people actually want to send is "how's the line" or "we're by the
-- bar". That is a room at a place, not a private channel between strangers.
--
-- The distinction is a safety decision, not a product preference: out.
-- publishes where people are, right now, with a photo. A private message
-- channel bolted onto live location data is the exact combination that
-- produces harassment, and there is nobody here to moderate it. A room is
-- public within the app, so it polices itself and can be moderated with the
-- machinery posts already use.
--
-- Rooms are ephemeral by construction. A message lives six hours, and the read
-- policy enforces it, so a quiet spot empties itself and nothing said tonight
-- is still hanging around next week.

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  body text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours',
  removed_at timestamptz,
  ip_hash text,
  constraint room_body_length check (char_length(btrim(body)) between 1 and 300)
);
create index if not exists room_messages_spot_idx
  on public.room_messages (spot_id, created_at desc);

alter table public.room_messages enable row level security;

drop policy if exists "room: read what's live" on public.room_messages;
create policy "room: read what's live" on public.room_messages
  for select using (removed_at is null and expires_at > now());

drop policy if exists "room: speak as yourself" on public.room_messages;
create policy "room: speak as yourself" on public.room_messages
  for insert to authenticated with check (author_id = auth.uid());

-- you may take back what you said; you may not touch anyone else's
drop policy if exists "room: unsay your own" on public.room_messages;
create policy "room: unsay your own" on public.room_messages
  for delete to authenticated using (author_id = auth.uid());

create or replace function public.room_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  recent int;
begin
  new.author_id := auth.uid();
  if new.author_id is null then
    raise exception 'sign in to say something';
  end if;
  select username into new.username from public.profiles where id = new.author_id;
  new.ip_hash := public.req_ip_hash();
  new.removed_at := null;
  -- ephemerality is not the client's to choose
  new.created_at := now();
  new.expires_at := now() + interval '6 hours';
  new.body := btrim(new.body);

  if char_length(new.body) < 1 or char_length(new.body) > 300 then
    raise exception 'keep it between 1 and 300 characters';
  end if;

  -- Links are the cheapest phishing and spam vector in a room full of
  -- students, and nothing anyone needs to say about a bar requires one.
  if new.body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|ly|gg|xyz|co)\M)' then
    raise exception 'no links in the room';
  end if;

  if new.body ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
    raise exception 'that is not going in the room';
  end if;

  -- a room is a conversation, not a feed: eight in a minute is already a lot
  select count(*) into recent from public.room_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  if recent >= 8 then
    raise exception 'slow down a second';
  end if;

  return new;
end $fn$;

drop trigger if exists room_guard on public.room_messages;
create trigger room_guard before insert on public.room_messages
  for each row execute function public.room_guard();

-- ------------------------------------------------------------- reporting ----
-- Same shape as post reports, same threshold: three distinct reporters and it
-- goes, without waiting for anyone to wake up and look at it.
create table if not exists public.room_reports (
  message_id uuid not null references public.room_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  ip_hash text,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter_id)
);
alter table public.room_reports enable row level security;

drop policy if exists "room reports: file your own" on public.room_reports;
create policy "room reports: file your own" on public.room_reports
  for insert to authenticated with check (reporter_id = auth.uid());
-- nobody reads the report pile from the app

create or replace function public.room_reports_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.reporter_id := auth.uid();
  if new.reporter_id is null then raise exception 'sign in first'; end if;
  new.ip_hash := public.req_ip_hash();
  if (select count(distinct ip_hash) from public.room_reports where message_id = new.message_id) >= 2 then
    update public.room_messages set removed_at = now()
      where id = new.message_id and removed_at is null;
  end if;
  return new;
end $fn$;

drop trigger if exists room_reports_guard on public.room_reports;
create trigger room_reports_guard before insert on public.room_reports
  for each row execute function public.room_reports_guard();

-- realtime, so a room reads like a room
alter publication supabase_realtime add table public.room_messages;
