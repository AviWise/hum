-- out. — the gate question, as a number.
--
--   "Will anyone post a second time without being asked?"
--
-- Usage:  psql "$DATABASE_URL" -v from="'2026-08-01'" -v to="'2026-09-30'" -f scripts/retention.sql
-- Defaults to the last 30 days when :from / :to are not supplied.
\set from_date :from
\set to_date :to
\if :{?from}
\else
  \set from_date '(now() - interval ''30 days'')'
\endif
\if :{?to}
\else
  \set to_date 'now()'
\endif

with window_posts as (
  select p.*, coalesce(pr.username, p.username) as who
  from posts p
  left join profiles pr on pr.id = p.author_id
  where p.is_demo = false
    and p.created_at >= :from_date
    and p.created_at <  :to_date
),
by_author as (
  select author_id, who,
         count(*) as posts,
         min(created_at) as first_post,
         (array_agg(created_at order by created_at))[2] as second_post
  from window_posts
  where author_id is not null
  group by author_id, who
)

select 'unique posters' as measure,
       count(*)::text as value
from by_author

union all
select 'posted 2+ times',
       count(*) filter (where posts >= 2)::text || ' of ' || count(*)::text
       || ' (' || coalesce(round(100.0 * count(*) filter (where posts >= 2) / nullif(count(*), 0)), 0)::text || '%)'
from by_author

union all
select 'posted 3+ times',
       count(*) filter (where posts >= 3)::text
from by_author

union all
select 'median hours, 1st to 2nd post',
       coalesce(round(percentile_cont(0.5) within group (
         order by extract(epoch from (second_post - first_post)) / 3600.0
       )::numeric, 1)::text, 'n/a — nobody has posted twice')
from by_author
where second_post is not null

union all
select 'posts total (real, excludes demo)',
       count(*)::text
from window_posts

union all
select 'spots with any post',
       count(distinct coalesce(spot_id, 'field:' || place_name))::text
from window_posts

union all
select 'busiest spot',
       coalesce((select coalesce(spot_id, place_name) || ' (' || count(*)::text || ')'
                 from window_posts group by coalesce(spot_id, place_name)
                 order by count(*) desc limit 1), 'none yet')

union all
-- "opened the app and posted nothing": accounts that exist and have viewed at
-- least one post (an impression) but never posted in the window
select 'signed up, viewed, never posted',
       count(*)::text
from (
  select u.id
  from auth.users u
  where u.created_at < :to_date
    and exists (select 1 from impressions i where i.viewer_id = u.id)
    and not exists (select 1 from window_posts w where w.author_id = u.id)
) q

union all
select 'accounts total',
       count(*)::text from auth.users

union all
select 'impressions logged',
       count(*)::text from impressions
where shown_at >= :from_date and shown_at < :to_date;
