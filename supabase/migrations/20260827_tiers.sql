-- Orgs publish; groups converse. That is the whole distinction, and most of it
-- is already structural: group_messages is a different table from posts, so a
-- group cannot put anything on the map even if it wanted to, and orgs are
-- world-readable by policy so one cannot be hidden.
--
-- The gap was names. A private group called "AU Housing" or "Film Society
-- Official" is invisible to everyone outside it, which makes it a decent
-- vehicle for social engineering inside a school — you get a code and a
-- convincing name and people assume they are somewhere official. Groups now
-- face the same reserved-name check orgs do.
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
  if public.is_reserved(group_name) then
    raise exception 'pick a name that is not the university''s or an org''s';
  end if;
  -- and not the name of a real student org at that school either
  select domain into dom from public.school_verifications
    where user_id = me and (expires_at is null or expires_at > now());
  if dom is null then raise exception 'verify your school first'; end if;
  if exists (
    select 1 from public.orgs o
    where o.school_domain = dom and public.name_token(o.name) = public.name_token(group_name)
  ) then
    raise exception 'a student org here already goes by that name';
  end if;
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
