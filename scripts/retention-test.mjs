// F2, tested: the clock actually deletes, and it does not delete the things
// whose deletion would be the harm.
//
// A purge that silently does nothing reports the same "0 rows" as a purge with
// nothing to do, so every case here is seeded backdated and then checked both
// ways: what should be gone is gone, and what must survive survived.
//
// node scripts/retention-test.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const res = []
const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? '  ok  ' : ' FAIL '} ${n}${c ? '' : '  <-- ' + d}`) }
const yearsAgo = (n) => new Date(Date.now() - n * 365.25 * 864e5).toISOString().slice(0, 10)
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `hum.ret.${tag}@example.com`
  await c.auth.signUp({ email, password: `ret-${tag}-99`, options: { data: { username: `ret.${tag}`, birth_date: yearsAgo(22) } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `ret-${tag}-99` })
  return { c, uid: data.user.id, email }
}

const a = await mk('a')
const b = await mk('b')
// dm_threads is unique on (lo, hi), so the never-accepted request needs its
// own counterparty rather than reusing the accepted pair
const c = await mk('c')
const emails = [a.email, b.email, c.email]
const TABLES = ['room_messages', 'group_messages', 'dm_messages', 'dm_threads', 'posts', 'impressions', 'room_reports', 'reports', 'admin_reads']
const has = async (t, id) => (await sql.unsafe(`select 1 from ${t} where id = $1`, [id])).length > 0

let ids = {}
try {
  for (const t of TABLES) await sql.unsafe(`alter table ${t} disable trigger user`)

  // ---- content that is past its window and must go --------------------
  const [rmOld] = await sql`insert into room_messages (spot_id, author_id, username, body, created_at, expires_at)
    values ('admo', ${a.uid}, 'ret.a', 'old room message', now() - interval '8 hours', now() - interval '2 hours') returning id`
  const [rmNew] = await sql`insert into room_messages (spot_id, author_id, username, body)
    values ('admo', ${a.uid}, 'ret.a', 'fresh room message') returning id`
  // reported and never acted on: held back, or the report cascades away with
  // the evidence it is about
  const [rmRep] = await sql`insert into room_messages (spot_id, author_id, username, body, created_at, expires_at)
    values ('admo', ${a.uid}, 'ret.a', 'old but reported', now() - interval '8 hours', now() - interval '2 hours') returning id`
  await sql`insert into room_reports (message_id, reporter_id, ip_hash) values (${rmRep.id}, ${b.uid}, 'ip-ret')`

  const [gmOld] = await sql`insert into groups (name, school_domain, join_code, created_by)
    values ('ret group', 'american.edu', 'RETCODE1', ${a.uid}) returning id`
  const [msgOld] = await sql`insert into group_messages (group_id, author_id, username, body, created_at, expires_at)
    values (${gmOld.id}, ${a.uid}, 'ret.a', 'old group message', now() - interval '8 days', now() - interval '1 day') returning id`

  const pair = a.uid < b.uid ? { lo: a.uid, hi: b.uid } : { lo: b.uid, hi: a.uid }
  const [thAcc] = await sql`insert into dm_threads (lo, hi, started_by, created_at, accepted_at)
    values (${pair.lo}, ${pair.hi}, ${a.uid}, now() - interval '300 days', now() - interval '299 days') returning id`
  const [dmOld] = await sql`insert into dm_messages (thread_id, author_id, body, created_at)
    values (${thAcc.id}, ${a.uid}, 'a message from last year', now() - interval '200 days') returning id`
  const [dmNew] = await sql`insert into dm_messages (thread_id, author_id, body, created_at)
    values (${thAcc.id}, ${a.uid}, 'a message from this week', now() - interval '3 days') returning id`

  // a request nobody ever accepted
  const rq = c.uid < a.uid ? { lo: c.uid, hi: a.uid } : { lo: a.uid, hi: c.uid }
  const [thReq] = await sql`insert into dm_threads (lo, hi, started_by, created_at)
    values (${rq.lo}, ${rq.hi}, ${c.uid}, now() - interval '40 days') returning id`

  const [pOld] = await sql`insert into posts (spot_id, title, author_id, username, created_at, expires_at, audience)
    values ('admo', 'fixture: old post', ${a.uid}, 'ret.a', now() - interval '100 days', now() - interval '100 days' + interval '6 hours', 'city') returning id`
  const [pDemo] = await sql`insert into posts (spot_id, title, author_id, username, created_at, expires_at, audience, is_demo)
    values ('admo', 'fixture: old demo', ${a.uid}, 'ret.a', now() - interval '100 days', now() - interval '100 days' + interval '6 hours', 'city', true) returning id`
  const [pRep] = await sql`insert into posts (spot_id, title, author_id, username, created_at, expires_at, audience)
    values ('admo', 'fixture: old but reported', ${a.uid}, 'ret.a', now() - interval '100 days', now() - interval '100 days' + interval '6 hours', 'city') returning id`
  await sql`insert into reports (post_id, user_id, ip_hash) values (${pRep.id}, ${b.uid}, 'ip-ret')`

  const [impOld] = await sql`insert into impressions (post_id, viewer_id, surface, shown_at)
    values (${pDemo.id}, ${b.uid}, 'city', now() - interval '40 days') returning id`

  const [arOld] = await sql`insert into admin_reads (admin_id, via, thread_id, messages, read_at)
    values (${a.uid}, 'app', ${thAcc.id}, 1, now() - interval '3 years') returning id`
  const [arNew] = await sql`insert into admin_reads (admin_id, via, thread_id, messages, read_at)
    values (${a.uid}, 'app', ${thAcc.id}, 1, now() - interval '30 days') returning id`

  // things that must NEVER be purged
  await sql`insert into blocks (blocker_id, blocked_id, created_at)
    values (${a.uid}, ${b.uid}, now() - interval '400 days')`
  await sql`update age_checks set declared_at = now() - interval '400 days' where user_id = ${a.uid}`

  ids = { rmOld, rmNew, rmRep, msgOld, thAcc, thReq, dmOld, dmNew, pOld, pDemo, pRep, impOld, arOld, arNew }
  for (const t of TABLES) await sql.unsafe(`alter table ${t} enable trigger user`)

  // ---- the dry run must SEE them, without removing anything -----------
  const dry = await sql`select * from public.purge_expired(true)`
  const dryFor = (n) => Number(dry.find((r) => r.what === n)?.rows ?? -1)
  ok('dry run counts the old room message', dryFor('room_messages') >= 1, `${dryFor('room_messages')}`)
  ok('dry run counts the old post', dryFor('posts') >= 1, `${dryFor('posts')}`)
  ok('dry run deleted nothing', await has('room_messages', rmOld.id), 'the dry run removed a row')

  // ---- the real thing --------------------------------------------------
  const run = await sql`select * from public.purge_expired(false)`
  const got = (n) => Number(run.find((r) => r.what === n)?.rows ?? -1)

  console.log('\n— what the clock removes —')
  ok('the expired room message is gone', !(await has('room_messages', rmOld.id)), 'still there')
  ok('the week-old group message is gone', !(await has('group_messages', msgOld.id)), 'still there')
  ok('the 200-day-old DM is gone', !(await has('dm_messages', dmOld.id)), 'still there')
  ok('the unaccepted request is gone', !(await has('dm_threads', thReq.id)), 'still there')
  ok('the 100-day-old post is gone', !(await has('posts', pOld.id)), 'still there')
  ok('the 40-day-old impression is gone', !(await has('impressions', impOld.id)), 'still there')
  ok('the 3-year-old audit row is gone', !(await has('admin_reads', arOld.id)), 'still there')

  console.log('\n— what it must not touch —')
  ok('a fresh room message survives', await has('room_messages', rmNew.id), 'it deleted a live message')
  ok('a recent DM survives', await has('dm_messages', dmNew.id), 'it deleted a live message')
  ok('an accepted thread survives', await has('dm_threads', thAcc.id), 'it deleted a real conversation')
  ok('a demo post is exempt', await has('posts', pDemo.id), 'the seeded layer was purged')
  ok('a recent audit row survives', await has('admin_reads', arNew.id), 'the log was over-purged')

  console.log('\n— evidence outlives the window —')
  ok('a reported room message is held', await has('room_messages', rmRep.id), 'the evidence was purged')
  ok('...and so is its report', (await sql`select 1 from room_reports where message_id = ${rmRep.id}`).length === 1, 'report gone')
  ok('a reported post is held', await has('posts', pRep.id), 'the evidence was purged')

  console.log('\n— things whose deletion is the harm —')
  const blk = await sql`select 1 from blocks where blocker_id = ${a.uid} and blocked_id = ${b.uid}`
  ok('a 400-day-old block still stands', blk.length === 1, 'purging it silently un-blocked someone')
  const age = await sql`select 1 from age_checks where user_id = ${a.uid}`
  ok('a birth date is not aged out', age.length === 1, 'a minor could re-declare')

  console.log('\n— it says what it did —')
  ok('the run reported the rows it took', got('posts') >= 1 && got('dm_messages') >= 1, JSON.stringify(run))
  const logged = await sql`select what, rows from purge_log where ran_at > now() - interval '2 minutes'`
  ok('and wrote them to purge_log', logged.length >= 3, `${logged.length} rows logged`)

  console.log('\n— the schedule is real —')
  const job = await sql`select schedule, active from cron.job where jobname = 'purge-expired'`
  ok('an hourly job exists and is active', job[0]?.active === true, JSON.stringify(job))

  console.log('\n— every policy has a predicate —')
  const pol = await sql`select count(*)::int n from retention_policy`
  ok('policy count matches what the purge reported', run.length === pol[0].n, `${run.length} vs ${pol[0].n}`)
} finally {
  for (const t of TABLES) { try { await sql.unsafe(`alter table ${t} enable trigger user`) } catch { /* already on */ } }
  const uids = [a.uid, b.uid, c.uid]
  await sql`delete from purge_log where ran_at > now() - interval '5 minutes'`
  await sql`delete from posts where title like 'fixture:%'`
  await sql`delete from room_messages where author_id = any(${uids})`
  await sql`delete from groups where created_by = any(${uids})`
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from admin_reads where admin_id = any(${uids})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}

const bad = res.filter((r) => !r).length
console.log(`\n${res.length - bad}/${res.length} held`)
process.exit(bad ? 1 : 0)
