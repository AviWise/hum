// Direct messages, attacked.
//
// The promises: only the two people in a thread can read it, a stranger gets
// exactly one message through and then nothing, replying accepts, blocking is
// silent and total, nobody can read a thread they are not in or start one on
// somebody else's behalf, and the report pile is not readable from the app.
//
// node scripts/dm-attack.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const results = []
const ok = (name, cond, detail = '') => {
  results.push(cond)
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${cond ? '' : '  <-- ' + detail}`)
}
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `outdc.dm.${tag}@example.com`
  await c.auth.signUp({ email, password: `dm-${tag}-99`, options: { data: { username: `dm.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `dm-${tag}-99` })
  return { c, uid: data.user.id, email }
}

const alex = await mk('alex')     // starts the conversation
const sam = await mk('sam')       // receives it
const nosy = await mk('nosy')     // is in nothing
const anon = createClient(URL, KEY)
const emails = [alex.email, sam.email, nosy.email]
const pair = (a, b) => (a < b ? { lo: a, hi: b } : { lo: b, hi: a })
const send = (who, thread, body) =>
  who.from('dm_messages').insert({ thread_id: thread, body }).select().single()

let thread
try {
  console.log('— starting a conversation —')
  {
    const { data, error } = await alex.c.from('dm_threads')
      .insert(pair(alex.uid, sam.uid)).select().single()
    ok('you can start one with someone', !error && !!data, error?.message)
    thread = data?.id
    const [row] = await sql`select started_by, accepted_at from dm_threads where id = ${thread}`
    ok('it records who started it', row.started_by === alex.uid, 'wrong starter')
    ok('...and starts unaccepted', row.accepted_at === null, 'pre-accepted')
  }
  {
    const p = pair(sam.uid, nosy.uid)
    const { error } = await alex.c.from('dm_threads').insert(p)
    const rows = await sql`select 1 from dm_threads where lo = ${p.lo} and hi = ${p.hi}`
    ok('you cannot start one between two other people', !!error && rows.length === 0, 'it was created')
  }

  console.log('\n— the request only gets one through —')
  {
    const { error } = await send(alex.c, thread, 'hey — you were at Suns last night?')
    ok('the first message lands', !error, error?.message)
  }
  {
    const { error } = await send(alex.c, thread, 'hello? hello? hello?')
    ok('the second does not', !!error, 'a stranger sent twice before being answered')
  }
  {
    const { data } = await nosy.c.from('dm_messages').select('body').eq('thread_id', thread)
    ok('an outsider reads nothing', (data?.length ?? 0) === 0, `${data?.length} messages visible`)
    const { data: t } = await nosy.c.from('dm_threads').select('id').eq('id', thread)
    ok('...and cannot even see the thread', (t?.length ?? 0) === 0, `${t?.length} threads visible`)
    const { data: a } = await anon.from('dm_messages').select('body')
    ok('signed out reads nothing', (a?.length ?? 0) === 0, `${a?.length} messages visible`)
  }

  console.log('\n— answering is accepting —')
  {
    const { error } = await send(sam.c, thread, 'yeah! the late show')
    ok('the recipient can answer', !error, error?.message)
    const [row] = await sql`select accepted_at from dm_threads where id = ${thread}`
    ok('...which accepts the thread', !!row.accepted_at, 'still pending')
    const { error: e2 } = await send(alex.c, thread, 'small world')
    ok('...and now both can talk freely', !e2, e2?.message)
  }

  console.log('\n— blocking is silent and total —')
  {
    await sam.c.from('blocks').insert({ blocker_id: sam.uid, blocked_id: alex.uid })
    const { error } = await send(alex.c, thread, 'are you there')
    ok('a blocked sender cannot send', !!error, 'the message went through')
    const { data } = await alex.c.from('blocks').select('blocker_id')
    ok('...and cannot see that they were blocked', (data?.length ?? 0) === 0, `${data?.length} blocks visible`)
    const { data: mine } = await sam.c.from('blocks').select('blocked_id')
    ok('the blocker sees their own list', (mine?.length ?? 0) === 1, `${mine?.length} rows`)
    const { error: e2 } = await send(sam.c, thread, 'testing my own side')
    ok('...and neither side can write while a block stands', !!e2, 'the blocker could still write')
    await sam.c.from('blocks').delete().eq('blocked_id', alex.uid)
  }
  {
    const { error } = await nosy.c.from('blocks').insert({ blocker_id: alex.uid, blocked_id: sam.uid })
    const rows = await sql`select 1 from blocks where blocker_id = ${alex.uid}`
    ok('you cannot block on someone else’s behalf', !!error && rows.length === 0, 'a block was planted')
  }

  console.log('\n— a fresh thread, checked the other way round —')
  {
    const p = pair(sam.uid, nosy.uid)
    const { data: t2 } = await sam.c.from('dm_threads').insert(p).select().single()
    const { error } = await sam.c.from('dm_threads')
      .update({ accepted_at: new Date().toISOString() }).eq('id', t2.id)
    const [row] = await sql`select accepted_at from dm_threads where id = ${t2.id}`
    ok('the starter cannot accept their own request', !!error && row.accepted_at === null,
      error?.message || 'they accepted it themselves')
    const { error: e2 } = await nosy.c.from('dm_threads')
      .update({ accepted_at: new Date().toISOString() }).eq('id', t2.id)
    const [row2] = await sql`select accepted_at from dm_threads where id = ${t2.id}`
    ok('the recipient can', !e2 && !!row2.accepted_at, e2?.message || 'acceptance did not stick')
  }

  console.log('\n— what does not go in —')
  {
    const { error } = await send(alex.c, thread, 'check this out http://not-a-scam.example')
    ok('links are refused', !!error, 'a link went through')
  }
  {
    const { error } = await send(alex.c, thread, 'x'.repeat(501))
    ok('over-long messages are refused', !!error, 'a 501-char message went through')
  }
  {
    const { error } = await alex.c.from('dm_messages')
      .insert({ thread_id: thread, body: 'forged', author_id: sam.uid }).select().single()
    const rows = await sql`select author_id from dm_messages where body = 'forged'`
    ok('you cannot write as the other person',
      !!error || (rows.length > 0 && rows[0].author_id === alex.uid), 'it stored under them')
  }
  {
    const { error } = await sam.c.from('dm_messages').update({ body: 'words in your mouth' })
      .eq('thread_id', thread).eq('author_id', alex.uid)
    const rows = await sql`select 1 from dm_messages where body = 'words in your mouth'`
    ok('nobody can edit anyone’s words', rows.length === 0, error?.message || 'a message was rewritten')
  }

  console.log('\n— reporting —')
  {
    const { error } = await sam.c.from('dm_reports').insert({ thread_id: thread, note: 'creepy' })
    ok('a participant can report a thread', !error, error?.message)
    const { error: e2 } = await nosy.c.from('dm_reports').insert({ thread_id: thread, note: 'nosy report' })
    ok('an outsider cannot report a thread they are not in', !!e2, 'an outsider filed a report')
    const { data } = await sam.c.from('dm_reports').select('note')
    ok('the report pile is not readable from the app', (data?.length ?? 0) === 0, `${data?.length} rows`)
    const [row] = await sql`select reviewed_at from dm_reports where thread_id = ${thread}`
    ok('reports queue unreviewed', row?.reviewed_at === null, 'arrived pre-reviewed')
  }
} finally {
  const uids = [alex.uid, sam.uid, nosy.uid]
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from blocks where blocker_id = any(${uids})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}

const bad = results.filter((r) => !r).length
console.log(`\n${results.length - bad}/${results.length} held`)
process.exit(bad ? 1 : 0)
