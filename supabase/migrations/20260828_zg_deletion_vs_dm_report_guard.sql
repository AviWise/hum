-- The same collision as zf, one table over.
--
-- ORDERING: 'zg', after 'zf'.
--
-- dm_reports_update_guard freezes thread_id so a report cannot be re-pointed at
-- a different conversation after the fact. When the departing user's threads
-- cascade away, the ON DELETE SET NULL on dm_reports.thread_id is an UPDATE, the
-- guard put the thread_id back, and the delete failed on a foreign key to a row
-- that was already gone.
--
-- Enumerated rather than discovered this time. Every BEFORE UPDATE guard in the
-- schema that freezes a column was listed, and checked against the columns this
-- work made nullable:
--
--   dm_reports_update_guard  thread_id, reporter_id   <- both, fixed here
--   room_update_guard        author_id                <- fixed in zf
--   dm_threads_guard         lo, hi                   <- threads are deleted,
--                                                        never updated, by the
--                                                        cascade
--   profiles_guard           full_name, ...           <- profiles likewise
--
-- reports and group_reports have no update guard at all, so their SET NULL runs
-- unopposed. That is the whole list; "both doors" is a phrase to distrust.

create or replace function public.dm_reports_update_guard() returns trigger
language plpgsql security definer set search_path = public, extensions as $fn$
begin
  if auth.uid() is not null
     and coalesce(current_setting('hum.account_deletion', true), '') <> 'on' then
    new.thread_id := old.thread_id;
    new.reporter_id := old.reporter_id;
    new.note := old.note;
    new.created_at := old.created_at;
  end if;
  return new;
end $fn$;
