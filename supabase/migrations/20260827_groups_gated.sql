-- Groups belong to a university, and getting in takes three things: the code,
-- somebody's approval, and a verified address at that school.
--
-- The code alone was too thin. A code travels — read across a corridor, pasted
-- into a group chat, screenshotted — and once it leaves the building anyone
-- holding it was in. Approval means a person still decides, and the school
-- check means the person deciding is choosing among their own classmates
-- rather than the internet.
--
-- Still no dorm and no floor anywhere: the group carries a school domain,
-- which is an institution, and a name its members typed.

alter table public.groups add column if not exists school_domain text references public.schools(domain);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  approved boolean,
  unique (group_id, user_id)
);
create index if not exists gjr_group_idx on public.group_join_requests (group_id) where decided_at is null;
alter table public.group_join_requests enable row level security;

drop policy if exists "join requests: yours, or your group's" on public.group_join_requests;
create policy "join requests: yours, or your group's" on public.group_join_requests
  for select to authenticated using (user_id = auth.uid() or public.in_group(group_id));
-- no insert/update from the client: both run through functions that check the
-- school and the approver

-- a group is made by somebody who has proved where they go
create or replace function public.create_group(group_name text) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  dom text;
  code text;
  g public.groups%rowtype;
begin
  if me is null then raise exception 'sign in first'; end if;
  if public.is_suspended(me) then raise exception 'your account is suspended'; end if;
  if not public.is_adult(me) then raise exception 'groups are 18+'; end if;
  select domain into dom from public.school_verifications
    where user_id = me and (expires_at is null or expires_at > now());
  if dom is null then raise exception 'verify your school first'; end if;
  if (select count(*) from public.group_members where user_id = me) >= 20 then
    raise exception 'that is a lot of groups already';
  end if;
  loop
    code := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), 'OIl01+/=', 'xyzw'), 1, 6));
    exit when not exists (select 1 from public.groups where join_code = code);
  end loop;
  insert into public.groups (name, join_code, created_by, school_domain)
    values (btrim(group_name), code, me, dom) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, me, 'owner');
  return json_build_object('id', g.id, 'name', g.name, 'join_code', g.join_code, 'school_domain', g.school_domain);
end $fn$;

-- the code no longer admits anybody; it asks
drop function if exists public.join_group(text);

create or replace function public.request_group(code text) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  g public.groups%rowtype;
  dom text;
  n int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if public.is_suspended(me) then raise exception 'your account is suspended'; end if;
  if not public.is_adult(me) then raise exception 'groups are 18+'; end if;
  select * into g from public.groups where join_code = upper(btrim(code));
  -- one message for every failure, so codes and schools cannot be probed
  if g.id is null then raise exception 'that code does not work'; end if;
  select domain into dom from public.school_verifications
    where user_id = me and (expires_at is null or expires_at > now());
  if dom is null or dom is distinct from g.school_domain then
    raise exception 'that code does not work';
  end if;
  select count(*) into n from public.group_members where group_id = g.id;
  if n >= g.max_members then raise exception 'that code does not work'; end if;
  if exists (select 1 from public.group_members where group_id = g.id and user_id = me) then
    return json_build_object('id', g.id, 'name', g.name, 'status', 'member');
  end if;
  insert into public.group_join_requests (group_id, user_id) values (g.id, me)
    on conflict (group_id, user_id) do update set requested_at = now(), decided_at = null, approved = null;
  return json_build_object('id', g.id, 'name', g.name, 'status', 'asked');
end $fn$;

create or replace function public.decide_group_request(request uuid, approve boolean) returns json
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  me uuid := auth.uid();
  r public.group_join_requests%rowtype;
  g public.groups%rowtype;
  n int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into r from public.group_join_requests where id = request;
  if r.id is null then raise exception 'no such request'; end if;
  select * into g from public.groups where id = r.group_id;
  -- anyone already inside can vouch; this is a floor, not a hierarchy
  if not exists (select 1 from public.group_members where group_id = r.group_id and user_id = me) then
    raise exception 'that is not your group';
  end if;
  if r.decided_at is not null then raise exception 'already decided'; end if;
  if approve then
    select count(*) into n from public.group_members where group_id = r.group_id;
    if n >= g.max_members then raise exception 'that group is full'; end if;
    insert into public.group_members (group_id, user_id) values (r.group_id, r.user_id)
      on conflict do nothing;
  end if;
  update public.group_join_requests set decided_at = now(), approved = approve where id = request;
  return json_build_object('approved', approve);
end $fn$;
