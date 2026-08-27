// The gate question as a number, runnable without psql.
//   node scripts/retention.mjs [fromISO] [toISO]
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const from = process.argv[2] ? new Date(process.argv[2]) : new Date(Date.now() - 30 * 864e5)
const to = process.argv[3] ? new Date(process.argv[3]) : new Date()

const rows = await sql`
  with window_posts as (
    select p.* from posts p
    where p.is_demo = false and p.created_at >= ${from} and p.created_at < ${to}
  ),
  by_author as (
    select author_id, count(*) posts, min(created_at) first_post,
           (array_agg(created_at order by created_at))[2] second_post
    from window_posts where author_id is not null group by author_id
  )
  select
    (select count(*) from by_author) as unique_posters,
    (select count(*) from by_author where posts >= 2) as posted_2plus,
    (select count(*) from by_author where posts >= 3) as posted_3plus,
    (select round(percentile_cont(0.5) within group (
        order by extract(epoch from (second_post - first_post))/3600.0)::numeric, 1)
     from by_author where second_post is not null) as median_hours_to_second,
    (select count(*) from window_posts) as posts_total,
    (select count(distinct coalesce(spot_id, 'field:'||place_name)) from window_posts) as spots_with_posts,
    (select coalesce(spot_id, place_name)||' ('||count(*)||')' from window_posts
      group by coalesce(spot_id, place_name) order by count(*) desc limit 1) as busiest_spot,
    (select count(*) from auth.users u
      where u.created_at < ${to}
        and exists (select 1 from impressions i where i.viewer_id = u.id)
        and not exists (select 1 from window_posts w where w.author_id = u.id)) as viewed_never_posted,
    (select count(*) from auth.users) as accounts_total,
    (select count(*) from impressions where shown_at >= ${from} and shown_at < ${to}) as impressions
`
const r = rows[0]
const pct = r.unique_posters > 0 ? Math.round((100 * r.posted_2plus) / r.unique_posters) : 0
console.log(`\nout. — retention, ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}\n`)
console.log(`  unique posters                 ${r.unique_posters}`)
console.log(`  posted 2+ times                ${r.posted_2plus} of ${r.unique_posters}  (${pct}%)   <-- THE GATE`)
console.log(`  posted 3+ times                ${r.posted_3plus}`)
console.log(`  median hours 1st -> 2nd post   ${r.median_hours_to_second ?? 'n/a — nobody has posted twice'}`)
console.log(`  posts total (real, no demo)    ${r.posts_total}`)
console.log(`  spots with any post            ${r.spots_with_posts} of 115`)
console.log(`  busiest spot                   ${r.busiest_spot ?? 'none yet'}`)
console.log(`  signed up, viewed, no post     ${r.viewed_never_posted}`)
console.log(`  accounts total                 ${r.accounts_total}`)
console.log(`  impressions logged             ${r.impressions}\n`)
await sql.end()
