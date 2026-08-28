-- The missing account-deletion path (the piece left open inside F2).
--
-- ORDERING: 'zd' so it sorts after 'zc'.
--
-- F2 made the clock delete: content ages out under pg_cron. What it did not
-- build was a way for a person to leave. "Nothing is stored forever except a
-- person's account" was the note; this is that note closed.
--
-- Deleting an account is not one DELETE, because the schema does three
-- different things with a departing user, and two of them are wrong:
--
--   posts.author_id          ON DELETE SET NULL — posts SURVIVE the account
--                            with the username still printed on them. Deleting
--                            your account would have left your posts on the map
--                            under your name. This is the opposite of the bug
--                            you would expect, and the easiest one to miss.
--   room_messages.author_id  ON DELETE CASCADE — a reported message vanishes,
--                            and room_reports cascades from message_id, so the
--                            report goes with the evidence it is about.
--   *_reports.reporter_id    ON DELETE CASCADE — every report you ever FILED is
--                            destroyed when you leave, open ones included. The
--                            person this hurts is the one who reported a
--                            harasser and then deleted their account to get
--                            away from him: the case against him leaves with
--                            her. Found while writing this, not in the audit.
--
-- The two rules from F2 still outrank convenience here. Evidence outlives the
-- window: content under an open report is kept, detached from the person rather
-- than deleted with them, and the predicates below are the purge's own, copied
-- verbatim so there is one definition of "acted on" and not two. And some
-- deletions are the harm, which is why reports survive their reporter.

-- ---------------------------------------------------------------- structure --
-- Cascades that destroy evidence become SET NULL. Every table touched here is
-- empty today (room_messages 0, dm_reports 0, dm_threads 0), so this is free
-- now and would not have been later.
do $$
declare c record;
begin
  for c in
    select n.nspname || '.' || cl.relname as tbl, k.conname,
           a.attname as col, k.confrelid::regclass::text as ref
    from pg_constraint k
    join pg_class cl on cl.oid = k.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.confdeltype = 'c' and n.nspname = 'public'
      and (cl.relname, a.attname) in (
        ('room_messages','author_id'),
        ('dm_reports','reporter_id'),
        ('dm_reports','thread_id'),
        ('reports','user_id'),
        ('group_reports','reporter_id'))
      -- A column inside a primary key cannot be made nullable. room_reports is
      -- keyed (message_id, reporter_id) to dedupe repeat reports, so its
      -- reporter is the one that cannot be detached this way; see the residual
      -- note below. Checked rather than assumed, so a future key change here
      -- does not turn into a migration that fails halfway.
      and not exists (
        select 1 from pg_constraint pk
        where pk.conrelid = k.conrelid and pk.contype = 'p'
          and a.attnum = any(pk.conkey))
  loop
    execute format('alter table %s alter column %I drop not null', c.tbl, c.col);
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references %s(id) on delete set null',
                   c.tbl, c.conname, c.col, c.ref);
    raise notice 'deletion: %.% is now ON DELETE SET NULL', c.tbl, c.col;
  end loop;
end $$;

-- RESIDUAL, stated rather than hidden: room_reports.reporter_id stays ON DELETE
-- CASCADE because it is half of that table's primary key. If a person who filed
-- a room report deletes their account, that report row still goes. What changed
-- is that the reported MESSAGE no longer goes with it — author_id is SET NULL
-- above — so the words survive even when that particular report does not.
-- Closing this properly means re-keying room_reports on a surrogate id, which is
-- a bigger change than this migration should make on its own.

-- A room message that outlives its author keeps its body and loses its byline.
alter table public.room_messages alter column username drop not null;

-- A DM thread cannot be detached from its participants the way a post can be
-- detached from its author — both sides are the thread's identity. So an open
-- report on a thread takes a copy of it before the cascade runs, and the report
-- itself now survives the thread (thread_id became SET NULL above).
alter table public.dm_reports add column if not exists preserved jsonb;
comment on column public.dm_reports.preserved is
  'Thread contents snapshotted at account deletion, when the live thread is about to cascade away. Written only by delete_my_account; read only through read_preserved_thread, which logs the read.';

-- admin_reads must be able to record a read of a thread that no longer exists.
alter table public.admin_reads alter column thread_id drop not null;

-- ------------------------------------------------------------- moderation ---
-- The snapshot gets the same treatment as the live thread: moderators only, and
-- the read is logged before it is served. A log a moderator can route around is
-- decoration (F5), and that applies to the copy as much as the original.
create or replace function public.read_preserved_thread(r uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare snap jsonb; t uuid;
begin
  if not public.is_admin() then
    raise exception 'not a moderator' using errcode = '42501';
  end if;
  select dr.preserved, dr.thread_id into snap, t
    from public.dm_reports dr where dr.id = r and dr.reviewed_at is null;
  if snap is null then
    raise exception 'no preserved evidence on that report' using errcode = '42501';
  end if;

  insert into public.admin_reads (admin_id, via, thread_id, report_id, messages)
  values (auth.uid(), 'app', t, r, jsonb_array_length(snap));

  return snap;
end $fn$;

revoke execute on function public.read_preserved_thread(uuid) from public, anon;
grant execute on function public.read_preserved_thread(uuid) to authenticated;

-- --------------------------------------------------------------- deletion ---
create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  uid uuid := auth.uid();
  snapped int := 0;
  held_posts int := 0;
  gone_posts int := 0;
  held_room int := 0;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  -- 1. Copy any open-report DM thread this person is in, before the cascade.
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

  -- 2. Posts held as evidence lose their author and keep their content; the
  --    predicate is purge_expired's, verbatim.
  update public.posts
     set author_id = null, username = null
   where author_id = uid
     and id in (select post_id from public.reports
                 where resolved_at is null and post_id is not null);
  get diagnostics held_posts = row_count;

  -- 3. Everything else they posted goes. Without this they would stay on the
  --    map under their name, because author_id is SET NULL rather than CASCADE.
  delete from public.posts where author_id = uid;
  get diagnostics gone_posts = row_count;

  -- 4. Same rule for room messages, same predicate as the purge.
  update public.room_messages
     set author_id = null, username = null
   where author_id = uid
     and removed_at is null
     and exists (select 1 from public.room_reports rr where rr.message_id = room_messages.id);
  get diagnostics held_room = row_count;

  -- 5. The account itself. Profile, birth date, school verifications,
  --    memberships, DM threads, push subscriptions, likes, impressions and
  --    blocks in both directions all cascade from here.
  --
  --    Two consequences worth naming rather than discovering later. Blocks in
  --    both directions go, so a departing account's blocks stop protecting
  --    anyone — but the account they protected against can no longer be reached
  --    by it either, and a returning person is a new account regardless. And
  --    age_checks goes, so someone who deletes and re-registers re-declares
  --    their birth date; that is no weaker than any first-time signup, which is
  --    the honest bar for a self-declared gate (F7).
  delete from auth.users where id = uid;

  return jsonb_build_object(
    'deleted', true,
    'posts_deleted', gone_posts,
    'posts_held_as_evidence', held_posts,
    'room_messages_held_as_evidence', held_room,
    'dm_threads_snapshotted', snapped
  );
end $fn$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
