// The room, attacked.
//
// A room is public speech in a place, so the promises are narrower than DMs
// but they still have to hold: you speak as yourself, you can unsay your own
// and nobody else's, links and slurs don't go in, flooding is refused, three
// reporters bury a message, and nothing said tonight is readable next week.
//
// node scripts/room-attack.mjs
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
  const email = `hum.room.${tag}@example.com`
  await c.auth.signUp({ email, password: `room-${tag}-99`, options: { data: { username: `room.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `room-${tag}-99` })
  return { c, uid: data.user.id, email }
}

const me = await mk('me')
const them = await mk('them')
const third = await mk('third')
const anon = createClient(URL, KEY)
const emails = [me.email, them.email, third.email]
const say = (who, body, extra = {}) =>
  who.from('room_messages').insert({ spot_id: 'admo', body, ...extra }).select().single()

try {
  console.log('— speaking —')
  const { data: mine, error } = await say(me.c, 'line is about ten deep, moving fast')
  ok('a signed-in account can speak', !error && !!mine, error?.message)
  ok('the byline is theirs', mine?.username === 'room.me', mine?.username)
  {
    const { error: e } = await anon.from('room_messages').insert({ spot_id: 'admo', body: 'hello from nobody' })
    ok('signed out cannot speak', !!e, 'anonymous message landed')
  }
  {
    const { data } = await say(me.c, 'posing as someone else', { author_id: them.uid, username: 'room.them' })
    const [row] = await sql`select author_id, username from room_messages where id = ${data.id}`
    ok('you cannot speak as someone else', row.author_id === me.uid && row.username === 'room.me',
      `${row.username}`)
  }

  console.log('\n— what does not go in —')
  {
    const { error: e } = await say(me.c, 'free drinks here http://totally-legit.example')
    ok('links are refused', !!e, 'a link went in')
  }
  {
    const { error: e } = await say(me.c, 'come to freestuff.com now')
    ok('bare domains too', !!e, 'a bare domain went in')
  }
  {
    const { error: e } = await say(me.c, 'x'.repeat(301))
    ok('over-long messages are refused', !!e, 'a 301-char message went in')
  }
  {
    const { error: e } = await say(me.c, '   ')
    ok('whitespace-only is refused', !!e, 'an empty message went in')
  }

  console.log('\n— flooding —')
  {
    let blocked = false
    for (let i = 0; i < 12; i++) {
      const { error: e } = await say(them.c, `flood ${i}`)
      if (e) { blocked = true; break }
    }
    ok('a flood is stopped', blocked, '12 messages in a row all landed')
  }

  console.log('\n— taking it back —')
  {
    const { error: e } = await them.c.from('room_messages').delete().eq('id', mine.id)
    const [still] = await sql`select 1 from room_messages where id = ${mine.id}`
    ok('you cannot delete someone else’s', !!still, e?.message || 'it was deleted')
  }
  {
    const { data: d } = await say(me.c, 'actually never mind')
    await me.c.from('room_messages').delete().eq('id', d.id)
    const [gone] = await sql`select 1 from room_messages where id = ${d.id}`
    ok('you can delete your own', !gone, 'it survived')
  }
  {
    const { error: e } = await them.c.from('room_messages').update({ body: 'words in your mouth' }).eq('id', mine.id)
    const [row] = await sql`select body from room_messages where id = ${mine.id}`
    ok('nobody can edit anyone’s words', row.body.startsWith('line is about ten'), e?.message || row.body)
  }

  console.log('\n— reporting —')
  {
    const { data: bad } = await say(third.c, 'something worth reporting')
    // Distinct ip_hash is what counts, and the guard stamps it from the
    // request — so seeding has to go around the guard, or both rows land with
    // the same (null-ish) hash and the threshold never trips.
    await sql.unsafe('alter table room_reports disable trigger room_reports_guard')
    await sql`insert into room_reports (message_id, reporter_id, ip_hash) values
      (${bad.id}, ${me.uid}, 'ip-a'), (${bad.id}, ${them.uid}, 'ip-b')`
    await sql.unsafe('alter table room_reports enable trigger room_reports_guard')
    const { error: e } = await third.c.from('room_reports').insert({ message_id: bad.id })
    const [row] = await sql`select removed_at from room_messages where id = ${bad.id}`
    ok('three reporters bury it', !!row.removed_at, e?.message || 'still visible')
    const { data: seen } = await anon.from('room_messages').select('id').eq('id', bad.id)
    ok('...and it is gone for everyone', (seen?.length ?? 0) === 0, `${seen?.length} rows`)
  }
  {
    const { data } = await anon.from('room_reports').select('message_id')
    ok('the report pile is not readable', (data?.length ?? 0) === 0, `${data?.length} rows`)
  }

  console.log('\n— nothing said tonight is here next week —')
  {
    const { data: d } = await say(me.c, 'this one is about to age out')
    const [row] = await sql`select expires_at from room_messages where id = ${d.id}`
    const hours = (Date.parse(row.expires_at) - Date.now()) / 36e5
    ok('a message expires in about six hours', hours > 5.5 && hours < 6.5, `${hours.toFixed(1)}h`)
    await sql`update room_messages set expires_at = now() - interval '1 minute' where id = ${d.id}`
    const { data: seen } = await anon.from('room_messages').select('id').eq('id', d.id)
    ok('an expired message is unreadable', (seen?.length ?? 0) === 0, `${seen?.length} rows`)
  }
  {
    const { data: d } = await say(me.c, 'trying to live forever', { expires_at: new Date(Date.now() + 400 * 864e5).toISOString() })
    const [row] = await sql`select expires_at from room_messages where id = ${d.id}`
    const days = (Date.parse(row.expires_at) - Date.now()) / 864e5
    ok('the client cannot choose how long it lives', days < 1, `${days.toFixed(0)} days`)
  }
} finally {
  await sql`delete from room_messages where spot_id = 'admo' and author_id = any(${[me.uid, them.uid, third.uid]})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}

const bad = results.filter((r) => !r).length
console.log(`\n${results.length - bad}/${results.length} held`)
process.exit(bad ? 1 : 0)
