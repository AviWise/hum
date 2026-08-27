-- room_reports_guard refused any connection without a JWT, which locks out the
-- service role as well as the client — so nothing could seed or moderate from
-- outside the app. coalesce keeps the client path exactly as strict (a request
-- carrying a JWT always resolves to auth.uid(), so nobody can report as someone
-- else) while letting a direct connection supply its own values.
create or replace function public.room_reports_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  new.reporter_id := coalesce(auth.uid(), new.reporter_id);
  if new.reporter_id is null then raise exception 'sign in first'; end if;
  new.ip_hash := coalesce(public.req_ip_hash(), new.ip_hash);
  if (select count(distinct ip_hash) from public.room_reports where message_id = new.message_id) >= 2 then
    update public.room_messages set removed_at = now()
      where id = new.message_id and removed_at is null;
  end if;
  return new;
end $fn$;
