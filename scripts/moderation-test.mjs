// The queue, and whether a suspension actually stops anyone.
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const res = []
const ok = (n,c,d='') => { res.push(c); console.log(`${c?'  ok  ':' FAIL '} ${n}${c?'':'  <-- '+d}`) }
const run = (...a) => execFileSync('node', ['scripts/moderation.mjs', ...a], { encoding: 'utf8' })
const yearsAgo = (n) => new Date(Date.now() - n*365.25*864e5).toISOString().slice(0,10)
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `outdc.mod.${tag}@example.com`
  await c.auth.signUp({ email, password:`mod-${tag}-99`, options:{ data:{ username:`mod.${tag}`, birth_date: yearsAgo(22) } } })
  const { data } = await c.auth.signInWithPassword({ email, password:`mod-${tag}-99` })
  return { c, uid: data.user.id, email, name: `mod.${tag}` }
}
const pest = await mk('pest'), victim = await mk('victim')
const emails = [pest.email, victim.email]
try {
  const pair = pest.uid < victim.uid ? { lo: pest.uid, hi: victim.uid } : { lo: victim.uid, hi: pest.uid }
  const { data: t } = await pest.c.from('dm_threads').insert(pair).select().single()
  await pest.c.from('dm_messages').insert({ thread_id: t.id, body: 'something a person would report' })
  await victim.c.from('dm_reports').insert({ thread_id: t.id, note: 'wont leave me alone' })

  console.log('— the queue —')
  const q = run()
  ok('the report is listed', q.includes('reported conversations (1)'), q.slice(0,200))
  ok('it names both people and the reporter', q.includes('mod.pest') && q.includes('mod.victim'), '')
  ok('the note is shown', q.includes('wont leave me alone'), '')
  ok('the contents are NOT shown in the queue', !q.includes('something a person would report'),
     'private messages were dumped into a listing')

  console.log('\n— reading takes a deliberate command —')
  const r = run('read', t.id)
  ok('the thread reads in full when asked', r.includes('something a person would report'), r.slice(0,200))
  ok('...and says it is still a request', r.includes('still a request'), '')

  console.log('\n— suspension —')
  const s = run('suspend', 'mod.pest', '7', 'harassment')
  ok('the tool confirms', s.includes('cannot post'), s.slice(0,120))
  ok('...and says reading still works', s.includes('not the door'), '')
  {
    // accept the thread first, or the request rule answers before suspension
    // ever gets asked — and then this proves nothing
    await sql`update dm_threads set accepted_at = now() where id = ${t.id}`
    const { error } = await pest.c.from('dm_messages').insert({ thread_id: t.id, body: 'still here' })
    ok('a suspended account cannot message', !!error && /suspend/i.test(error.message), error?.message)
  }
  {
    const { error } = await pest.c.from('room_messages').insert({ spot_id:'admo', body:'still here too' })
    ok('...cannot speak in a room', !!error && /suspend/i.test(error.message), error?.message)
  }
  {
    const { error } = await pest.c.from('posts').insert({ spot_id:'admo', title:'still posting', expires_at:new Date(Date.now()+36e5).toISOString() })
    ok('...cannot post', !!error && /suspend/i.test(error.message), error?.message)
  }
  {
    const { data } = await pest.c.from('posts').select('id').limit(1)
    ok('...but can still read the city', Array.isArray(data), 'reading was taken away too')
  }
  {
    const { error } = await pest.c.from('profiles').update({ suspended_until: null }).eq('id', pest.uid)
    const [row] = await sql`select suspended_until from profiles where id = ${pest.uid}`
    ok('cannot lift their own suspension', !!row.suspended_until, error?.message || 'they lifted it')
  }
  {
    const c2 = run('clear', (await sql`select id from dm_reports where thread_id = ${t.id}`)[0].id)
    ok('a report can be cleared', c2.includes('Cleared'), c2)
    ok('...and drops out of the queue', run().includes('reported conversations (0)'), '')
  }
  {
    run('unsuspend', 'mod.pest')
    const { error } = await pest.c.from('room_messages').insert({ spot_id:'admo', body:'back again' })
    ok('unsuspending restores speech', !error, error?.message)
  }
} finally {
  await sql`delete from room_messages where author_id = any(${[pest.uid, victim.uid]})`
  await sql`delete from dm_threads where lo = any(${[pest.uid, victim.uid]}) or hi = any(${[pest.uid, victim.uid]})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}
const bad = res.filter(r=>!r).length
console.log(`\n${res.length-bad}/${res.length} held`)
process.exit(bad?1:0)
