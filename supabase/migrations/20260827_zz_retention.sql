-- F2: nothing is stored forever.
--
-- ORDERING: zz_ so it sorts last — it references almost every table, including
-- admin_reads from 20260827_read_log.sql.
--
-- Until now "expires" meant a row stopped being READABLE. Room messages said
-- six hours, group messages said seven days, and both were `expires_at > now()`
-- in a read policy while the row itself sat there indefinitely, along with
-- every expired post and every DM ever sent. Two problems: the blast radius of
-- a leak or a subpoena was the entire history of the app, and the interface was
-- telling students something that was not true.
--
-- Now the clock actually deletes.
--
-- WHAT IS DELIBERATELY NEVER PURGED, and why — deleting these causes the harm
-- rather than preventing it:
--   blocks            deleting a block silently un-blocks someone
--   age_checks        purging a birth date lets a minor re-declare
--   profiles/orgs/groups/schools/admins/reserved_handles   identity, not content
--   org_members/group_members                              membership, not content
-- likes and comments are not listed because they cascade with their post.
--
-- REMAINING GAP, stated honestly: these windows bound how long CONTENT lives,
-- but there is still no account-deletion path, so an account and its profile
-- persist until somebody removes them by hand. F2 is not fully closed until a
-- person can delete themselves.

create table if not exists public.retention_policy (
  name text primary key,
  keep interval not null,
  note text not null
);
alter table public.retention_policy enable row level security;

-- World-readable on purpose: this is a privacy promise in machine-readable
-- form, and the app should be able to render it rather than restate it in copy
-- that drifts out of date.
drop policy if exists "retention: anyone may read the policy" on public.retention_policy;
create policy "retention: anyone may read the policy" on public.retention_policy
  for select using (true);

insert into public.retention_policy (name, keep, note) values
  ('room_messages',       interval '6 hours',  'what the room says on the tin; a reported message is held until it is acted on'),
  ('group_messages',      interval '7 days',   'what the group says on the tin'),
  ('dm_messages',         interval '180 days', 'about a college year; a thread under an open report is held'),
  ('dm_threads',          interval '30 days',  'a message request nobody ever accepted'),
  ('posts',               interval '90 days',  'a post older than a season is a record, not a plan; demo posts are exempt'),
  ('impressions',         interval '30 days',  'who saw what — the most personal table nothing reads back'),
  ('push_log',            interval '30 days',  'send-once bookkeeping'),
  ('push_subs',           interval '30 days',  'dead endpoints, measured from the failure'),
  ('school_challenges',   interval '1 day',    'a code is good for fifteen minutes'),
  ('school_verifications',interval '0 days',   'expired verifications; re-verifying is the point'),
  ('reports',             interval '90 days',  'measured from resolution, not filing'),
  ('dm_reports',          interval '90 days',  'measured from review'),
  ('group_reports',       interval '90 days',  'measured from review'),
  ('org_claims',          interval '90 days',  'measured from review'),
  ('group_join_requests', interval '30 days',  'measured from the decision'),
  ('admin_reads',         interval '2 years',  'the audit log outlives what it describes, but not forever'),
  ('live_cache',          interval '7 days',   'busyness cache'),
  ('place_cache',         interval '30 days',  'third-party place lookups')
on conflict (name) do update set keep = excluded.keep, note = excluded.note;

-- Proof it ran. "The absence of an error is not evidence of an effect" is the
-- lesson this repo keeps relearning, so the purge records what it removed.
create table if not exists public.purge_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  what text not null,
  rows bigint not null
);
alter table public.purge_log enable row level security;
-- no policies: service-role and the owner only

-- One step. The predicates live in the function source where they are
-- versioned and reviewable; only the intervals come from the policy table.
create or replace function public.purge_step(tbl text, pred text, dry boolean)
returns bigint language plpgsql as $fn$
declare n bigint;
begin
  if dry then
    execute format('select count(*) from public.%I where %s', tbl, pred) into n;
  else
    execute format(
      'with gone as (delete from public.%I where %s returning 1) select count(*) from gone', tbl, pred) into n;
  end if;
  return n;
end $fn$;

create or replace function public.purge_expired(dry_run boolean default false)
returns table (what text, rows bigint)
language plpgsql as $fn$
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
      '(select thread_id from public.dm_reports where reviewed_at is null)',
    -- a request nobody ever answered; cascades to its messages and reads
    'dm_threads',
      'accepted_at is null and created_at < now() - %L::interval and id not in '
      '(select thread_id from public.dm_reports where reviewed_at is null)',
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
end $fn$;

revoke all on function public.purge_expired(boolean) from public, anon, authenticated;
revoke all on function public.purge_step(text, text, boolean) from public, anon, authenticated;

-- hourly, off the hour so it does not land with everything else
select cron.unschedule('purge-expired') where exists (
  select 1 from cron.job where jobname = 'purge-expired');
select cron.schedule('purge-expired', '17 * * * *', $cron$select public.purge_expired()$cron$);
