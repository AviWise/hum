-- Moderation needs teeth beyond deleting a message.
--
-- Removing content answers "that post was bad". It does not answer "this
-- account keeps doing it", which is the case a report queue actually exists
-- for. A suspension stops someone writing anywhere — posts, rooms, messages —
-- without deleting their account or their history.
--
-- Reads are untouched on purpose: a suspended account can still see the city.
-- The penalty is losing the microphone, not the door.
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists suspended_reason text;

-- profiles_guard already freezes org fields for anyone holding a JWT; the same
-- seam keeps a suspended account from lifting its own suspension.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null then
    new.kind := old.kind;
    new.school_domain := old.school_domain;
    new.claimed_at := old.claimed_at;
    new.suspended_until := old.suspended_until;
    new.suspended_reason := old.suspended_reason;
  end if;
  if new.bio is not null then
    new.bio := nullif(trim(new.bio), '');
  end if;
  return new;
end $fn$;

create or replace function public.is_suspended(u uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select exists (
    select 1 from public.profiles
    where id = u and suspended_until is not null and suspended_until > now()
  )
$fn$;

-- one guard per surface, so a suspension cannot be routed around by picking a
-- different place to type
create or replace function public.room_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  recent int;
begin
  new.author_id := auth.uid();
  if new.author_id is null then raise exception 'sign in to say something'; end if;
  if public.is_suspended(new.author_id) then raise exception 'your account is suspended'; end if;
  select username into new.username from public.profiles where id = new.author_id;
  new.ip_hash := public.req_ip_hash();
  new.removed_at := null;
  new.created_at := now();
  new.expires_at := now() + interval '6 hours';
  new.body := btrim(new.body);

  if char_length(new.body) < 1 or char_length(new.body) > 300 then
    raise exception 'keep it between 1 and 300 characters';
  end if;
  if new.body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|ly|gg|xyz|co)\M)' then
    raise exception 'no links in the room';
  end if;
  if new.body ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
    raise exception 'that is not going in the room';
  end if;
  select count(*) into recent from public.room_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  if recent >= 8 then raise exception 'slow down a second'; end if;
  return new;
end $fn$;

create or replace function public.dm_suspension_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if public.is_suspended(coalesce(auth.uid(), new.author_id)) then
    raise exception 'your account is suspended';
  end if;
  return new;
end $fn$;

-- sorts after dm_guard, so it runs on a row that has already been normalised
drop trigger if exists dm_zz_suspension on public.dm_messages;
create trigger dm_zz_suspension before insert on public.dm_messages
  for each row execute function public.dm_suspension_guard();

create or replace function public.posts_suspension_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if public.is_suspended(coalesce(auth.uid(), new.author_id)) then
    raise exception 'your account is suspended';
  end if;
  return new;
end $fn$;

drop trigger if exists posts_zz_suspension on public.posts;
create trigger posts_zz_suspension before insert on public.posts
  for each row execute function public.posts_suspension_guard();
