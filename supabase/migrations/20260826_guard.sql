-- posts_guard follows the rename and learns about the three photo sizes.
create or replace function public.posts_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  bucket text := 'https://hxmjszgvkynrwscelnzx.supabase.co/storage/v1/object/public/post-photos/%';
begin
  new.ip_hash := public.req_ip_hash();
  new.removed_at := null;
  new.featured := false;
  new.is_demo := false;
  new.author_id := auth.uid();
  if new.author_id is null then
    raise exception 'sign in to post';
  end if;
  select username into new.username from public.profiles where id = new.author_id;

  if new.spot_id is null then
    if new.place_name is null or new.lat is null or new.lng is null then
      raise exception 'pick a place first';
    end if;
    new.place_name := trim(new.place_name);
    if char_length(new.place_name) < 2 or char_length(new.place_name) > 60 then
      raise exception 'that place name doesn''t look right';
    end if;
    if new.lat < 38.7 or new.lat > 39.12 or new.lng < -77.4 or new.lng > -76.8 then
      raise exception 'that''s outside the map';
    end if;
    if new.place_name ~* '(https?://|www\.|\.(com|net|org|io|ly|gg|xyz)\M)'
       or new.place_name ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
      raise exception 'that place name isn''t going on the map';
    end if;
  else
    new.place_name := null; new.lat := null; new.lng := null;
  end if;

  -- every stored image must live in our own bucket, at all three sizes
  if new.photo_path is not null then
    if new.photo_path not like bucket then raise exception 'that photo isn''t from here'; end if;
    if new.thumb_path is not null and new.thumb_path not like bucket then raise exception 'that photo isn''t from here'; end if;
    if new.mid_path is not null and new.mid_path not like bucket then raise exception 'that photo isn''t from here'; end if;
  end if;

  if new.title ~* '(https?://|www\.|\.(com|net|org|io|ly|gg|xyz)\M)' then
    raise exception 'links aren''t allowed in posts';
  end if;
  if new.title ~* '\m(nigg(a|er)s?|fagg?(ot)?s?|trann(y|ies)|kikes?|spics?|chinks?|wetbacks?|retards?)\M' then
    raise exception 'that post isn''t going on the map';
  end if;
  if (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.posts where ip_hash = new.ip_hash and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'easy there — wait a few minutes between posts';
  end if;
  if (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '24 hours') >= 20
     or (select count(*) from public.posts where ip_hash = new.ip_hash and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'you''ve hit today''s posting limit';
  end if;
  if (select count(*) from public.posts where created_at > now() - interval '5 minutes') >= 30 then
    raise exception 'the map''s getting flooded — try again in a bit';
  end if;
  return new;
end $fn$;

-- reports now soft-delete via removed_at rather than the old hidden flag
create or replace function public.reports_hide() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if (select count(distinct ip_hash) from public.reports where post_id = new.post_id) >= 3 then
    update public.posts set removed_at = now(), hidden = true
      where id = new.post_id and removed_at is null;
  end if;
  return new;
end $fn$;
