-- room_update_guard was undoing the account deletion it never knew about.
--
-- ORDERING: 'zf', after 'zd' which made room_messages.author_id nullable.
--
-- Found by running scripts/deletion-test.mjs, not by reading. delete_my_account
-- failed with
--
--   insert or update on table "room_messages" violates foreign key constraint
--   room_messages_author_id_fkey ... where: "delete from auth.users where id = uid"
--
-- which reads like a broken cascade and is not. room_update_guard freezes an
-- edited room message so nobody can rewrite what they said:
--
--   if auth.uid() is not null then new.author_id := old.author_id; ... end if;
--
-- ON DELETE SET NULL is implemented as an UPDATE on the referencing row. That
-- UPDATE runs inside the deleting user's session, so auth.uid() is not null, so
-- the guard put the author_id back, and the foreign key then refused a row
-- pointing at a user who was in the middle of being deleted. The same guard also
-- silently reverted delete_my_account's own detach of reported room messages —
-- an update that reported success and changed nothing, which is the failure
-- shape this repo has now hit often enough to have a TRAPS entry for it.
--
-- The fix is not to weaken the freeze. Allowing author_id to be nulled by anyone
-- would let a person quietly detach themselves from something they said. Instead
-- the deletion path announces itself with a transaction-local flag, and only
-- that path is exempt. A PostgREST client cannot set it: the connection sets
-- role, search_path and request.* and nothing else, and there is no RPC here
-- that forwards a caller-supplied setting name.

create or replace function public.room_update_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null
     and coalesce(current_setting('hum.account_deletion', true), '') <> 'on' then
    new.body := old.body;
    new.author_id := old.author_id;
    new.username := old.username;
    new.spot_id := old.spot_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $fn$;

-- Re-declared so the flag is raised before anything touches room_messages, and
-- lowered by the transaction ending rather than by anything remembering to.
create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  uid uuid := auth.uid();
  snapped int := 0;
  held_posts int := 0;
  gone_posts int := 0;
  held_room int := 0;
  gone_room int := 0;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  -- true = transaction-local; it cannot outlive this call
  perform set_config('hum.account_deletion', 'on', true);

  update public.dm_reports r
     set preserved = coalesce(r.preserved, (
           select jsonb_agg(jsonb_build_object(
                    'at', m.created_at,
                    'by_departed', m.author_id = uid,
                    'body', m.body) order by m.created_at)
           from public.dm_messages m where m.thread_id = r.thread_id))
   where r.reviewed_at is null
     and r.thread_id in (select t.id from public.dm_threads t where t.lo = uid or t.hi = uid);
  get diagnostics snapped = row_count;

  update public.posts
     set author_id = null, username = null
   where author_id = uid
     and id in (select post_id from public.reports
                 where resolved_at is null and post_id is not null);
  get diagnostics held_posts = row_count;

  delete from public.posts where author_id = uid;
  get diagnostics gone_posts = row_count;

  -- Reported room messages are detached and kept; the predicate is the purge's.
  update public.room_messages
     set author_id = null, username = null
   where author_id = uid
     and removed_at is null
     and exists (select 1 from public.room_reports rr where rr.message_id = room_messages.id);
  get diagnostics held_room = row_count;

  -- The rest go explicitly rather than by cascade, so that what leaves is
  -- decided here and visible in the return value instead of inferred.
  delete from public.room_messages where author_id = uid;
  get diagnostics gone_room = row_count;

  delete from auth.users where id = uid;

  return jsonb_build_object(
    'deleted', true,
    'posts_deleted', gone_posts,
    'posts_held_as_evidence', held_posts,
    'room_messages_deleted', gone_room,
    'room_messages_held_as_evidence', held_room,
    'dm_threads_snapshotted', snapped
  );
end $fn$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
