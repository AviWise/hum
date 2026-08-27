// Temporary cohort so scripts/retention.mjs can be checked against known answers.
// node scripts/retention-fixture.mjs seed | clear
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })
const mode = process.argv[2] || 'seed'
const mkUser = async (tag) => {
  const [u] = await sql`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    ${'hum.fx.' + tag + '@example.com'}, crypt('x', gen_salt('bf')), now(), now() - interval '10 days', now(), '{}',
    ${sql.json({ username: 'fx.' + tag })}) returning id`
  return u.id
}
if (mode === 'clear') {
  await sql`delete from posts where title like 'fixture:%'`
  const g = await sql`delete from auth.users where email like 'hum.fx.%' returning id`
  console.log('fixture cleared:', g.length, 'users')
} else {
  await sql.unsafe('alter table posts disable trigger posts_guard')
  // three posters: one posted 3x, one 2x, one once; plus a lurker who only viewed
  const plan = [
    ['tripler', [72, 60, 48]],   // hours ago
    ['doubler', [30, 24]],
    ['once', [12]],
  ]
  const ids = {}
  for (const [tag, hours] of plan) {
    const uid = await mk(tag)
    ids[tag] = uid
    for (const h of hours) {
      await sql`insert into posts (spot_id, title, username, author_id, created_at, expires_at, is_demo)
        values ('shaw', ${'fixture: ' + tag + ' @' + h + 'h'}, ${'fx.' + tag}, ${uid},
        now() - (${h} || ' hours')::interval, now() - (${h} || ' hours')::interval + interval '3 hours', false)`
    }
  }
  const lurker = await mk('lurker')
  const [somePost] = await sql`select id from posts where title like 'fixture:%' limit 1`
  await sql`insert into impressions (post_id, viewer_id, surface) values (${somePost.id}, ${lurker}, 'city')`
  await sql.unsafe('alter table posts enable trigger posts_guard')
  console.log('seeded: tripler(3 posts), doubler(2), once(1), lurker(0 posts, 1 impression)')
  console.log('expected -> unique posters 3 | 2+ = 2 (67%) | 3+ = 1 | median gap = 9.0h | lurker counted once')
}
async function mk(tag) { return mkUser(tag) }
await sql.end()
