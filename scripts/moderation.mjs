// The queue somebody actually has to read.
//
// Public surfaces partly moderate themselves — three reporters bury a room
// message or a post. A DM cannot work that way: nobody else can see it to
// corroborate, so a reported thread sits here until a person looks. That
// person is you, and this is the tool.
//
//   node scripts/moderation.mjs                    # what's waiting
//   node scripts/moderation.mjs read <thread-id>   # the conversation, in full
//   node scripts/moderation.mjs clear <report-id>  # reviewed, nothing to do
//   node scripts/moderation.mjs suspend <username> <days> "<reason>"
//   node scripts/moderation.mjs unsuspend <username>
//
// Reading someone's private messages is a real intrusion, so it takes a
// deliberate command with an id in it — the queue below shows who and when,
// never the contents.
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const [cmd, arg, arg2, arg3] = process.argv.slice(2)
const ago = (t) => {
  const h = (Date.now() - Date.parse(t)) / 36e5
  return h < 1 ? `${Math.round(h * 60)}m ago` : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`
}

const list = async () => {
  const dms = await sql`
    select r.id, r.note, r.created_at, r.thread_id,
           rp.username as reporter, lo.username as lo_name, hi.username as hi_name,
           (select count(*)::int from dm_messages m where m.thread_id = r.thread_id) as msgs
    from dm_reports r
    join profiles rp on rp.id = r.reporter_id
    join dm_threads t on t.id = r.thread_id
    join profiles lo on lo.id = t.lo
    join profiles hi on hi.id = t.hi
    where r.reviewed_at is null
    order by r.created_at`
  console.log(`\n== reported conversations (${dms.length}) ==`)
  if (!dms.length) console.log('   nothing waiting')
  for (const d of dms) {
    console.log(`\n  ${d.id}`)
    console.log(`    @${d.lo_name} ↔ @${d.hi_name}  ·  ${d.msgs} messages  ·  reported by @${d.reporter} ${ago(d.created_at)}`)
    if (d.note) console.log(`    note: ${d.note}`)
    console.log(`    read it:  node scripts/moderation.mjs read ${d.thread_id}`)
  }

  // the public surfaces bury their own; this is the tail worth a human look
  const rooms = await sql`
    select m.id, m.spot_id, m.username, m.body, m.removed_at,
           count(distinct r.ip_hash)::int as reports
    from room_messages m join room_reports r on r.message_id = m.id
    where m.created_at > now() - interval '7 days'
    group by m.id order by reports desc, m.created_at desc limit 20`
  console.log(`\n== reported room messages, last 7 days (${rooms.length}) ==`)
  if (!rooms.length) console.log('   nothing reported')
  for (const r of rooms) {
    console.log(`  ${r.removed_at ? '[buried]' : '[STANDING]'} @${r.username} in ${r.spot_id} · ${r.reports} reporter(s)`)
    console.log(`      ${r.body.slice(0, 90)}`)
    if (!r.removed_at) console.log(`      bury it: node scripts/moderation.mjs bury ${r.id}`)
  }

  const posts = await sql`
    select p.id, p.username, p.title, p.removed_at, count(distinct r.ip_hash)::int as reports
    from posts p join reports r on r.post_id = p.id
    where p.created_at > now() - interval '7 days'
    group by p.id order by reports desc limit 20`
  console.log(`\n== reported posts, last 7 days (${posts.length}) ==`)
  if (!posts.length) console.log('   nothing reported')
  for (const p of posts) {
    console.log(`  ${p.removed_at ? '[removed]' : '[STANDING]'} @${p.username} · ${p.reports} reporter(s) · ${p.title.slice(0, 70)}`)
  }

  const susp = await sql`
    select username, suspended_until, suspended_reason from profiles
    where suspended_until is not null and suspended_until > now() order by suspended_until`
  if (susp.length) {
    console.log(`\n== suspended (${susp.length}) ==`)
    for (const s of susp) {
      const days = Math.ceil((Date.parse(s.suspended_until) - Date.now()) / 864e5)
      console.log(`  @${s.username} — ${days}d left · ${s.suspended_reason || 'no reason given'}`)
    }
  }
  console.log('')
}

const read = async () => {
  const [t] = await sql`
    select t.*, lo.username as lo_name, hi.username as hi_name
    from dm_threads t join profiles lo on lo.id = t.lo join profiles hi on hi.id = t.hi
    where t.id = ${arg}`
  if (!t) { console.log('no thread with that id'); return }
  const msgs = await sql`
    select m.body, m.created_at, p.username
    from dm_messages m join profiles p on p.id = m.author_id
    where m.thread_id = ${arg} order by m.created_at`
  // This connection is the database owner, so no policy stopped it. That is
  // the more powerful read, not the lesser one, and it gets logged as such:
  // via 'cli' with a null admin_id, because the actor here is whoever holds
  // the password rather than any app account.
  const [open] = await sql`
    select id from dm_reports
    where thread_id = ${arg} and reviewed_at is null order by created_at limit 1`
  await sql`
    insert into admin_reads (admin_id, via, thread_id, report_id, messages)
    values (null, 'cli', ${arg}, ${open?.id ?? null}, ${msgs.length})`

  console.log(`\n@${t.lo_name} ↔ @${t.hi_name} · started by @${t.started_by === t.lo ? t.lo_name : t.hi_name} · ${t.accepted_at ? 'accepted' : 'still a request'}\n`)
  for (const m of msgs) console.log(`  @${m.username}  ${ago(m.created_at)}\n    ${m.body}\n`)
  console.log(`  clear it:  node scripts/moderation.mjs clear <report-id>`)
  console.log(`  suspend:   node scripts/moderation.mjs suspend <username> 7 "reason"\n`)
}

const clear = async () => {
  const r = await sql`update dm_reports set reviewed_at = now() where id = ${arg} and reviewed_at is null returning id`
  console.log(r.length ? 'Cleared.' : 'No open report with that id.')
}

const bury = async () => {
  const r = await sql`update room_messages set removed_at = now() where id = ${arg} and removed_at is null returning id`
  console.log(r.length ? 'Buried — it is gone for everyone.' : 'No standing message with that id.')
}

const suspend = async () => {
  const days = Number(arg2)
  if (!arg || !Number.isFinite(days) || days <= 0) {
    console.log('usage: suspend <username> <days> "<reason>"'); return
  }
  const r = await sql`
    update profiles set suspended_until = now() + (${days} || ' days')::interval,
                        suspended_reason = ${arg3 || null}
    where username = ${arg} returning username, suspended_until`
  if (!r.length) { console.log('no account with that username'); return }
  console.log(`@${r[0].username} cannot post, say anything in a room, or send a message until ${new Date(r[0].suspended_until).toLocaleString()}.`)
  console.log('They can still read the city — the penalty is the microphone, not the door.')
}

const unsuspend = async () => {
  const r = await sql`update profiles set suspended_until = null, suspended_reason = null
    where username = ${arg} returning username`
  console.log(r.length ? `@${r[0].username} can speak again.` : 'no account with that username')
}

if (cmd === 'read') await read()
else if (cmd === 'clear') await clear()
else if (cmd === 'bury') await bury()
else if (cmd === 'suspend') await suspend()
else if (cmd === 'unsuspend') await unsuspend()
else await list()
await sql.end()
