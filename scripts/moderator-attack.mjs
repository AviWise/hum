// Moderator powers, attacked.
//
// The claim: a moderator can read a reported conversation ONLY while a report
// on it is open, can bury and suspend but never rewrite, cannot suspend
// themselves out of trouble, and a normal account gets none of it — including
// the account that filed the report.
//
// node scripts/moderator-attack.mjs
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
  const email = `outdc.modatk.${tag}@example.com`
  await c.auth.signUp({ email, password: `modatk-${tag}-99`, options: { data: { username: `modatk.${tag}`, birth_date: yearsAgo(24) } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `modatk-${tag}-99` })
  return { c, uid: data.user.id, email, name: `modatk.${tag}` }
}

const mod = await mk('mod')       // a moderator
const pest = await mk('pest')     // the reported party
const victim = await mk('victim') // the reporter
const nosy = await mk('nosy')     // an ordinary account
const emails = [mod.email, pest.email, victim.email, nosy.email]
let thread, reportId, roomMsg

try {
  await sql`insert into admins (user_id, note) values (${mod.uid}, 'test') on conflict do nothing`

  const pair = pest.uid < victim.uid ? { lo: pest.uid, hi: victim.uid } : { lo: victim.uid, hi: pest.uid }
  const { data: t } = await pest.c.from('dm_threads').insert(pair).select().single()
  thread = t.id
  await pest.c.from('dm_messages').insert({ thread_id: thread, body: 'the message that got reported' })
  // the reporter cannot read the pile back, so .select() after insert returns
  // nothing — which is the policy working, not a failure
  await victim.c.from('dm_reports').insert({ thread_id: thread, note: 'creepy' })
  const [rep] = await sql`select id from dm_reports where thread_id = ${thread}`
  reportId = rep.id
  const { data: rm } = await pest.c.from('room_messages').insert({ spot_id: 'admo', body: 'a room message worth burying' }).select().single()
  roomMsg = rm.id

  console.log('— an ordinary account gets none of it —')
  {
    const { data } = await nosy.c.from('dm_reports').select('id')
    ok('cannot read the queue', (data?.length ?? 0) === 0, `${data?.length} reports visible`)
    const { data: m } = await nosy.c.from('dm_messages').select('body').eq('thread_id', thread)
    ok('cannot read the reported thread', (m?.length ?? 0) === 0, `${m?.length} messages visible`)
    const { error } = await nosy.c.from('dm_reports').update({ reviewed_at: new Date().toISOString() }).eq('id', reportId)
    const [row] = await sql`select reviewed_at from dm_reports where id = ${reportId}`
    ok('cannot close a report', !row.reviewed_at, error?.message || 'it was closed')
    const { error: e2 } = await nosy.c.from('profiles')
      .update({ suspended_until: new Date(Date.now() + 864e5).toISOString() }).eq('id', pest.uid)
    const [p] = await sql`select suspended_until from profiles where id = ${pest.uid}`
    ok('cannot suspend anyone', !p.suspended_until, e2?.message || 'they suspended someone')
  }
  {
    // the person who filed it still only sees their own conversation
    const { data } = await victim.c.from('dm_reports').select('id, note')
    ok('even the reporter cannot read the queue', (data?.length ?? 0) === 0, `${data?.length} visible`)
  }
  {
    const { data } = await nosy.c.from('admins').select('user_id')
    ok('nobody can enumerate the moderators', (data?.length ?? 0) === 0, `${data?.length} rows`)
  }

  console.log('\n— a moderator, while the report is open —')
  {
    const { data } = await mod.c.from('dm_reports').select('id, note').eq('id', reportId)
    ok('sees the queue', (data?.length ?? 0) === 1, `${data?.length}`)
    const { data: m, error: me } = await mod.c.rpc('read_reported_thread', { t: thread })
    ok('can read the reported thread', !me && (m?.length ?? 0) === 1, me?.message || `${m?.length} messages`)
    // the RPC is now the only door: the table is shut even to a moderator
    const { data: direct } = await mod.c.from('dm_messages').select('body')
    ok('...and the table itself is shut to them', (direct?.length ?? 0) === 0, `${direct?.length} rows read directly`)
    const [logged] = await sql`select admin_id, via, messages from admin_reads where thread_id = ${thread}`
    ok('the read is logged, with a name on it', logged?.admin_id === mod.uid && logged?.via === 'app', JSON.stringify(logged))
    ok('...and how much was exposed', logged?.messages === 1, `${logged?.messages}`)
  }
  {
    const { data, error } = await nosy.c.rpc('read_reported_thread', { t: thread })
    ok('an ordinary account cannot call the read', !!error && !data?.length, 'it handed over messages')
    const { data: seen } = await nosy.c.from('admin_reads').select('id')
    ok('...nor see the log', (seen?.length ?? 0) === 0, `${seen?.length} rows`)
    const [n] = await sql`select count(*)::int as n from admin_reads where thread_id = ${thread}`
    ok('...and the refused attempt logged nothing', n.n === 1, `${n.n} log rows`)
  }
  {
    // append-only by omission: there is no update or delete policy for anyone
    const { error: ue } = await mod.c.from('admin_reads').update({ messages: 0 }).eq('thread_id', thread)
    await mod.c.from('admin_reads').delete().eq('thread_id', thread)
    const rows = await sql`select messages from admin_reads where thread_id = ${thread}`
    ok('a moderator cannot edit or erase the log',
      rows.length === 1 && rows[0].messages === 1, ue?.message || `${rows.length} rows, messages=${rows[0]?.messages}`)
  }
  {
    const { error } = await mod.c.from('dm_messages')
      .update({ body: 'rewritten' }).eq('thread_id', thread)
    const rows = await sql`select 1 from dm_messages where body = 'rewritten'`
    ok('cannot rewrite what was said', rows.length === 0, error?.message || 'a message was edited')
  }
  {
    const { error } = await mod.c.from('room_messages').update({ removed_at: new Date().toISOString() }).eq('id', roomMsg)
    const [row] = await sql`select removed_at, body from room_messages where id = ${roomMsg}`
    ok('can bury a room message', !!row.removed_at, error?.message || 'it stood')
    const { error: e2 } = await mod.c.from('room_messages').update({ body: 'not what they said' }).eq('id', roomMsg)
    const [row2] = await sql`select body from room_messages where id = ${roomMsg}`
    ok('...but not rewrite one', row2.body.startsWith('a room message'), e2?.message || row2.body)
  }
  {
    const { error } = await mod.c.from('profiles')
      .update({ suspended_until: new Date(Date.now() + 7 * 864e5).toISOString(), suspended_reason: 'harassment' })
      .eq('id', pest.uid)
    const [p] = await sql`select suspended_until, suspended_reason from profiles where id = ${pest.uid}`
    ok('can suspend the reported account', !!p.suspended_until, error?.message || 'nothing happened')
    ok('...with the reason recorded', p.suspended_reason === 'harassment', p.suspended_reason)
    const { error: e2 } = await pest.c.from('room_messages').insert({ spot_id: 'admo', body: 'still here' })
    ok('...and it bites immediately', !!e2 && /suspend/i.test(e2.message), e2?.message)
  }
  {
    // the interesting one: a moderator who gets suspended cannot undo it
    await sql`update profiles set suspended_until = now() + interval '3 days' where id = ${mod.uid}`
    const { error } = await mod.c.from('profiles').update({ suspended_until: null }).eq('id', mod.uid)
    const [row] = await sql`select suspended_until from profiles where id = ${mod.uid}`
    ok('a moderator cannot lift their own suspension', !!row.suspended_until, error?.message || 'they lifted it')
    await sql`update profiles set suspended_until = null where id = ${mod.uid}`
  }

  console.log('\n— closing the report closes the door —')
  {
    await mod.c.from('dm_reports').update({ reviewed_at: new Date().toISOString() }).eq('id', reportId)
    const [row] = await sql`select reviewed_at from dm_reports where id = ${reportId}`
    ok('the report is closed', !!row.reviewed_at, 'it stayed open')
    const { data: m, error: me } = await mod.c.rpc('read_reported_thread', { t: thread })
    ok('the thread is private again', !!me && !m?.length, `${m?.length} messages still readable`)
    const [n] = await sql`select count(*)::int as n from admin_reads where thread_id = ${thread}`
    ok('...and the refused read added nothing to the log', n.n === 1, `${n.n} log rows`)
  }
  {
    const { error } = await mod.c.from('dm_reports').update({ note: 'tampered' }).eq('id', reportId)
    const [row] = await sql`select note from dm_reports where id = ${reportId}`
    ok('a report cannot be edited, only closed', row.note === 'creepy', error?.message || row.note)
  }
} finally {
  const uids = [mod.uid, pest.uid, victim.uid, nosy.uid]
  // admin_reads has no FK to the thread on purpose — the log outlives what it
  // describes — so it does not cascade and the test clears it by hand
  if (thread) await sql`delete from admin_reads where thread_id = ${thread}`
  await sql`delete from room_messages where author_id = any(${uids})`
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from admins where user_id = any(${uids})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}

const bad = res.filter((r) => !r).length
console.log(`\n${res.length - bad}/${res.length} held`)
process.exit(bad ? 1 : 0)
