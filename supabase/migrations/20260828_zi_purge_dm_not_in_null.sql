-- The purge stopped purging DMs the moment a report outlived its thread.
--
-- ORDERING: 'zi', last of the 08-28 set.
--
-- zd made dm_reports.thread_id nullable so that a moderation case survives the
-- account deletion that destroys the conversation. purge_expired's DM
-- predicates were written when that column could not be null:
--
--   thread_id not in (select thread_id from public.dm_reports where reviewed_at is null)
--
-- NOT IN against a set containing NULL is NULL, never true, for every row. So
-- one detached report — exactly what the new deletion path creates — silently
-- switched off retention for dm_messages and dm_threads entirely. Not an error,
-- not a log line: the purge kept reporting "0 rows" for them, which is what it
-- also reports when there is nothing to do.
--
-- Caught by scripts/retention-test.mjs, which seeds backdated rows and asserts
-- both directions. This is the second time this week that a passing-looking "0"
-- turned out to be a guard that never fired, and the first time the test was
-- already there to catch it.
--
-- Regenerated from the live definition so the intervals and every other
-- predicate stay exactly as they were; only the two DM subqueries change.

CREATE OR REPLACE FUNCTION public.purge_expired(dry_run boolean DEFAULT false)
 RETURNS TABLE(what text, rows bigint)
 LANGUAGE plpgsql
AS $function$
declare
  p record;
  k text;
  step bigint;
  preds constant jsonb := jsonb_build_object(
    -- a reported message that nobody has acted on yet is held back, otherwise
    -- the report would cascade away with the evidence
    'room_messages',
      'created_at < now() - %L::interval and not (removed_at is null and exists '
      '(select 1 from public.room_reports r where r.message_id = room_messages.id))',
    'group_messages',
      'created_at < now() - %L::interval',
    'dm_messages',
      'created_at < now() - %L::interval and thread_id not in '
      '(select thread_id from public.dm_reports where reviewed_at is null and thread_id is not null)',
    -- a request nobody ever answered; cascades to its messages and reads
    'dm_threads',
      'accepted_at is null and created_at < now() - %L::interval and id not in '
      '(select thread_id from public.dm_reports where reviewed_at is null and thread_id is not null)',
    'posts',
      'created_at < now() - %L::interval and coalesce(is_demo, false) = false and id not in '
      '(select post_id from public.reports where resolved_at is null and post_id is not null)',
    'impressions',        'shown_at < now() - %L::interval',
    'push_log',           'sent_at < now() - %L::interval',
    'push_subs',          'failed_at is not null and failed_at < now() - %L::interval',
    'school_challenges',  'expires_at < now() - %L::interval',
    'school_verifications', 'expires_at < now() - %L::interval',
    'reports',            'resolved_at is not null and resolved_at < now() - %L::interval',
    'dm_reports',         'reviewed_at is not null and reviewed_at < now() - %L::interval',
    'group_reports',      'reviewed_at is not null and reviewed_at < now() - %L::interval',
    'org_claims',         'reviewed_at is not null and reviewed_at < now() - %L::interval',
    'group_join_requests','decided_at is not null and decided_at < now() - %L::interval',
    'admin_reads',        'read_at < now() - %L::interval',
    'live_cache',         'fetched_at < now() - %L::interval',
    'place_cache',        'fetched_at < now() - %L::interval'
  );
begin
  for p in select name, keep from public.retention_policy order by name loop
    k := preds ->> p.name;
    -- a policy row with no predicate would silently do nothing, which is
    -- exactly the failure this repo keeps hitting; say so instead
    if k is null then
      raise exception 'retention_policy has a row with no predicate: %', p.name;
    end if;
    step := public.purge_step(p.name, format(k, p.keep), dry_run);
    if not dry_run and step > 0 then
      insert into public.purge_log (what, rows) values (p.name, step);
    end if;
    what := p.name; rows := step; return next;
  end loop;
end $function$
;
