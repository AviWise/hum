// The one part the rest of the suite cannot reach: does a code actually leave
// the building? Sends to Resend's sandbox recipient rather than a student, via
// a temporary schools row that is removed whatever happens.
//
// node scripts/real-send-test.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const fail = []
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${cond ? '' : '  <-- ' + detail}`)
  if (!cond) fail.push(name)
}

const email = 'hum.realsend@example.com'
const c = createClient(URL, KEY, { auth: { persistSession: false } })
await c.auth.signUp({ email, password: 'real-send-99', options: { data: { username: 'real.send' } } })
const { data: signed } = await c.auth.signInWithPassword({ email, password: 'real-send-99' })
const uid = signed.user.id
const token = signed.session.access_token

const invoke = (body) => fetch(`${URL}/functions/v1/school-verify`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))

try {
  // resend.dev stands in for a university just long enough to send one mail
  await sql`insert into schools (domain, name, sort) values ('resend.dev', 'Sandbox', 999)
    on conflict (domain) do nothing`
  await sql`delete from school_challenges where user_id = ${uid}`

  console.log('— sending a real code —')
  const r = await invoke({ action: 'start', email: 'delivered@resend.dev' })
  ok('the send was accepted', r.body?.status === 'sent', `${r.status}: ${JSON.stringify(r.body)}`)
  ok('it names the school back', r.body?.school === 'Sandbox', JSON.stringify(r.body))
  ok('it says how long the code lasts', r.body?.expiresInMin === 15, JSON.stringify(r.body))

  const [ch] = await sql`select domain, code_hash, email_hash, attempts, expires_at from school_challenges where user_id = ${uid}`
  ok('a challenge was stored', !!ch, 'nothing pending')
  ok('the code is stored hashed, not in the clear', !!ch && /^[0-9a-f]{64}$/.test(ch.code_hash), ch?.code_hash?.slice(0, 12))
  ok('the address is stored hashed', !!ch && !ch.email_hash.includes('@'), ch?.email_hash)
  ok('it expires in the future', !!ch && Date.parse(ch.expires_at) > Date.now(), ch?.expires_at)

  console.log('\n— the 60-second gap holds —')
  const again = await invoke({ action: 'start', email: 'delivered@resend.dev' })
  ok('an immediate second request is refused', again.status === 429, `${again.status}: ${JSON.stringify(again.body)}`)
} finally {
  await sql`delete from school_challenges where user_id = ${uid}`
  await sql`delete from school_verifications where user_id = ${uid}`
  await sql`delete from auth.users where email = ${email}`
  await sql`delete from schools where domain = 'resend.dev'`
  const [{ n }] = await sql`select count(*)::int n from schools where domain = 'resend.dev'`
  console.log(`\ncleanup: sandbox school rows remaining = ${n}`)
  await sql.end()
}

console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
