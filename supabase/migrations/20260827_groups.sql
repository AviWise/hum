-- Private groups. The floor GroupMe, basically.
--
-- Deliberately NOT modelled as floors. There is no buildings table, no floor
-- number, no dorm — a group is called whatever its members typed, which means
-- there is nothing here to enumerate and nothing to leak. "My floor" is one
-- thing people will use it for, alongside "my four friends" and "everyone
-- going Friday".
--
-- Trust flows from whoever is already inside: you get in because a member
-- shares the code, the way somebody adds you to the GroupMe. There is no
-- search, no browse, no request-to-join by name — a searchable list of floor
-- groups IS the directory of who lives where, which is the thing we are
-- avoiding.
--
-- Messages last a week. This is an app about tonight, and the smaller the
-- archive the less there is to lose.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 50),
  join_code text not null unique,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  max_members int not null default 60
);
alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);
alter table public.group_members enable row level security;

-- definer, so the policy never queries the table it is protecting
create or replace function public.in_group(g uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid())
$fn$;

drop policy if exists "groups: members only" on public.groups;
create policy "groups: members only" on public.groups
  for select to authenticated using (public.in_group(id));
-- no insert policy: groups are made through create_group(), which mints the
-- code and puts the maker inside in one step

drop policy if exists "group_members: the roster is for the room" on public.group_members;
create policy "group_members: the roster is for the room" on public.group_members
  for select to authenticated using (public.in_group(group_id));
drop policy if exists "group_members: leave whenever" on public.group_members;
create policy "group_members: leave whenever" on public.group_members
  for delete to authenticated using (user_id = auth.uid());
-- and no insert policy: joining runs through join_group(code)

-- --------------------------------------------------------------- messages ----
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  removed_at timestamptz
);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at);
alter table public.group_messages enable row level security;

drop policy if exists "group msgs: read your groups" on public.group_messages;
create policy "group msgs: read your groups" on public.group_messages
  for select to authenticated
  using (removed_at is null and expires_at > now() and public.in_group(group_id));
drop policy if exists "group msgs: speak in your groups" on public.group_messages;
create policy "group msgs: speak in your groups" on public.group_messages
  for insert to authenticated with check (author_id = auth.uid() and public.in_group(group_id));
drop policy if exists "group msgs: unsay your own" on public.group_messages;
create policy "group msgs: unsay your own" on public.group_messages
  for delete to authenticated using (author_id = auth.uid());

create or replace function public.group_msg_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  recent int;
begin
  new.author_id := auth.uid();
  if new.author_id is null then raise exception 'sign in first'; end if;
  if public.is_suspended(new.author_id) then raise exception 'your account is suspended'; end if;
  if not public.in_group(new.group_id) then raise exception 'that is not your group'; end if;
  select username into new.username from public.profiles where id = new.author_id;
  new.body := btrim(new.body);
  new.removed_at := null;
  new.created_at := now();
  new.expires_at := now() + interval '7 days';
  if new.body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|ly|gg|xyz|co)\M)' then
    raise exception 'no links in a group';
  end if;
  if new.body ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
    raise exception 'not in a group';
  end if;
  select count(*) into recent from public.group_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'slow down a second'; end if;
  return new;
end $fn$;

drop trigger if exists group_msg_guard on public.group_messages;
create trigger group_msg_guard before insert on public.group_messages
  for each row execute function public.group_msg_guard();

-- ------------------------------------------------------ making and joining ----
create or replace function public.create_group(group_name text) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  code text;
  g public.groups%rowtype;
begin
  if me is null then raise exception 'sign in first'; end if;
  if public.is_suspended(me) then raise exception 'your account is suspended'; end if;
  -- private messaging is 18+, and a group is private messaging
  if not public.is_adult(me) then raise exception 'groups are 18+'; end if;
  if (select count(*) from public.group_members where user_id = me) >= 20 then
    raise exception 'that is a lot of groups already';
  end if;
  -- ambiguous characters left out: a code gets read aloud across a corridor
  loop
    code := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), 'OIl01+/=', 'xyzw'), 1, 6));
    exit when not exists (select 1 from public.groups where join_code = code);
  end loop;
  insert into public.groups (name, join_code, created_by) values (btrim(group_name), code, me) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, me, 'owner');
  return json_build_object('id', g.id, 'name', g.name, 'join_code', g.join_code);
end $fn$;

create or replace function public.join_group(code text) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  g public.groups%rowtype;
  n int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if public.is_suspended(me) then raise exception 'your account is suspended'; end if;
  if not public.is_adult(me) then raise exception 'groups are 18+'; end if;
  select * into g from public.groups where join_code = upper(btrim(code));
  -- one message for wrong code and full group, so the codes cannot be probed
  if g.id is null then raise exception 'that code does not work'; end if;
  select count(*) into n from public.group_members where group_id = g.id;
  if n >= g.max_members then raise exception 'that code does not work'; end if;
  insert into public.group_members (group_id, user_id) values (g.id, me)
    on conflict (group_id, user_id) do nothing;
  return json_build_object('id', g.id, 'name', g.name);
end $fn$;

-- ---------------------------------------------------------------- reports ----
-- A private group cannot self-police the way a public room does: nobody
-- outside can see it to corroborate. Same shape as a DM report — it queues for
-- a person, and leaving is the remedy you get immediately.
create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.group_reports enable row level security;
drop policy if exists "group reports: file your own" on public.group_reports;
create policy "group reports: file your own" on public.group_reports
  for insert to authenticated with check (reporter_id = auth.uid() and public.in_group(group_id));
drop policy if exists "group reports: moderators read" on public.group_reports;
create policy "group reports: moderators read" on public.group_reports
  for select to authenticated using (public.is_admin());
drop policy if exists "group reports: moderators close" on public.group_reports;
create policy "group reports: moderators close" on public.group_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- and the same rule as reported DMs: readable only while a report is open
create or replace function public.group_under_report(g uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (select 1 from public.group_reports r where r.group_id = g and r.reviewed_at is null)
$fn$;

drop policy if exists "group msgs: moderators read reported groups" on public.group_messages;
create policy "group msgs: moderators read reported groups" on public.group_messages
  for select to authenticated
  using (public.is_admin() and public.group_under_report(group_id));

create or replace function public.group_reports_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.reporter_id := coalesce(auth.uid(), new.reporter_id);
  if new.reporter_id is null then raise exception 'sign in first'; end if;
  new.reviewed_at := null;
  return new;
end $fn$;

drop trigger if exists group_reports_guard on public.group_reports;
create trigger group_reports_guard before insert on public.group_reports
  for each row execute function public.group_reports_guard();

alter publication supabase_realtime add table public.group_messages;
