// Leaving is a feature, and it has two rules it must not break:
// evidence outlives the window, and some deletions are the harm.
//
// Users are made by direct SQL rather than through the auth API on purpose:
// Supabase throttles signups, and a suite that burns that budget fails later in
// a way that looks exactly like a code regression (see TRAPS).
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

// Setup writes rows that the app's guards would refuse from a session that is
// not the author. Disabling those guards for the setup is the point: this suite
// tests deletion, not the guards, which have their own suites.
const TABLES = ['posts', 'room_messages', 'reports', 'room_reports', 'dm_threads', 'dm_messages', 'dm_reports']
const triggers = async (mode) => {
  for (const t of TABLES) await sql.unsafe(`alter table public.${t} ${mode} trigger user`)
}

// leftovers from an earlier crashed run, so a rerun is not poisoned by them
await sql`delete from auth.users where email like 'del.leaver.%@example.com' or email like 'del.other.%@example.com'`

let pass_ = 0, fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass_++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}
const mk = async (tag) => {
  const [u] = await sql`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            ${`del.${tag}.${Date.now()}@example.com`}, crypt('x', gen_salt('bf')), now(), now(), now(), '{}',
            ${sql.json({ username: `del.${tag}.${Math.random().toString(36).slice(2, 7)}` })}) returning id`
  return u.id
}

const A = await mk('leaver')
const B = await mk('other')
console.log(`leaver ${A}\nother  ${B}\n`)

await triggers('disable')
const [plain] = await sql`insert into posts (spot_id, title, username, author_id, expires_at, is_demo)
  values ('shaw', 'ordinary post', 'leaver', ${A}, now() + interval '3 hours', false) returning id`
const [reported] = await sql`insert into posts (spot_id, title, username, author_id, expires_at, is_demo)
  values ('shaw', 'reported post', 'leaver', ${A}, now() + interval '3 hours', false) returning id`
const [othersPost] = await sql`insert into posts (spot_id, title, username, author_id, expires_at, is_demo)
  values ('shaw', 'someone elses post', 'other', ${B}, now() + interval '3 hours', false) returning id`

// B reports A's post; A reports B's post. Both open.
await sql`insert into reports (post_id, user_id) values (${reported.id}, ${B})`
const [filedByA] = await sql`insert into reports (post_id, user_id) values (${othersPost.id}, ${A}) returning id`

// a room message by A, reported by B
const [rmsg] = await sql`insert into room_messages (spot_id, author_id, username, body, expires_at)
  values ('shaw', ${A}, 'leaver', 'reported room message', now() + interval '6 hours') returning id`
await sql`insert into room_reports (message_id, reporter_id) values (${rmsg.id}, ${B})`

// a DM thread between A and B with an open report on it
const [lo, hi] = A < B ? [A, B] : [B, A]
const [thread] = await sql`insert into dm_threads (lo, hi, started_by, accepted_at) values (${lo}, ${hi}, ${A}, now()) returning id`
await sql`insert into dm_messages (thread_id, author_id, body) values (${thread.id}, ${A}, 'something reportable')`
await sql`insert into dm_messages (thread_id, author_id, body) values (${thread.id}, ${B}, 'a reply')`
const [dmReport] = await sql`insert into dm_reports (thread_id, reporter_id) values (${thread.id}, ${B}) returning id`
await triggers('enable')

// ---- the leaver deletes their account ----
let result
await sql.begin(async (t) => {
  await t.unsafe(`set local role authenticated`)
  await t.unsafe(`set local request.jwt.claims = '${JSON.stringify({ sub: A, role: 'authenticated' })}'`)
  const [r] = await t`select public.delete_my_account() as r`
  result = r.r
})
console.log('delete_my_account ->', JSON.stringify(result), '\n')

console.log('the account is gone')
ok('auth user removed', (await sql`select 1 from auth.users where id = ${A}`).length === 0)
ok('profile removed', (await sql`select 1 from profiles where id = ${A}`).length === 0)
ok('birth date removed', (await sql`select 1 from age_checks where user_id = ${A}`).length === 0)

console.log('\ntheir content is gone')
ok('ordinary post deleted', (await sql`select 1 from posts where id = ${plain.id}`).length === 0)

console.log('\nevidence outlives the account')
const [rp] = await sql`select author_id, username, title from posts where id = ${reported.id}`
ok('reported post kept', !!rp)
ok('reported post has no author', rp && rp.author_id === null, rp && String(rp.author_id))
ok('reported post has no byline', rp && rp.username === null, rp && String(rp.username))
ok('reported post keeps its words', rp && rp.title === 'reported post')

const [rm] = await sql`select author_id, username, body from room_messages where id = ${rmsg.id}`
ok('reported room message kept', !!rm)
ok('room message has no author', rm && rm.author_id === null, rm && String(rm.author_id))
ok('room message keeps its words', rm && rm.body === 'reported room message')

console.log('\na report survives the person who filed it')
const [fa] = await sql`select user_id, resolved_at from reports where id = ${filedByA.id}`
ok('report filed by the leaver still exists', !!fa)
ok('...with the reporter detached', fa && fa.user_id === null, fa && String(fa.user_id))
ok('...and still open', fa && fa.resolved_at === null)

console.log('\nthe DM thread is gone but the case is not')
ok('dm thread removed', (await sql`select 1 from dm_threads where id = ${thread.id}`).length === 0)
const [dr] = await sql`select thread_id, preserved from dm_reports where id = ${dmReport.id}`
ok('dm report survived the thread', !!dr)
ok('...detached from the dead thread', dr && dr.thread_id === null)
ok('...carrying a snapshot', dr && Array.isArray(dr.preserved) && dr.preserved.length === 2,
   dr ? JSON.stringify(dr.preserved) : '')
ok('...with both sides of the conversation', dr && dr.preserved?.some((m) => m.by_departed) && dr.preserved?.some((m) => !m.by_departed))

// cleanup
await sql`delete from posts where id in (${reported.id}, ${othersPost.id})`
await sql`delete from room_messages where id = ${rmsg.id}`
await sql`delete from dm_reports where id = ${dmReport.id}`
// A detached report (thread_id null) left lying around is not inert: NOT IN
// against a set containing NULL is NULL, which switches off the DM half of
// purge_expired for the whole database. Leaving one behind would make this
// suite quietly break retention for every later run.
await sql`delete from dm_reports where thread_id is null`
await sql`delete from auth.users where id = ${B}`
await sql.end()
console.log(`\n${pass_} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
