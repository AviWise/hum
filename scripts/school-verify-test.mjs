// The campus tier, tested from the outside.
//
// The claim under test: a campus post reaches verified students of the
// AUTHOR's school, and nobody else — not the signed-out, not an unverified
// account, not a verified student of a DIFFERENT school. And no client can
// verify itself.
//
// node scripts/school-verify-test.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const results = []
const ok = (name, pass_, detail = '') => {
  results.push({ name, pass: pass_ })
  console.log(`${pass_ ? '  ok  ' : ' FAIL '} ${name}${pass_ ? '' : '  <-- ' + detail}`)
}

const mk = async (tag, email) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const addr = email || `outdc.sv.${tag}@example.com`
  await c.auth.signUp({ email: addr, password: `sv-test-${tag}-99`, options: { data: { username: `sv.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email: addr, password: `sv-test-${tag}-99` })
  return { c, uid: data.user.id, email: addr, token: data.session.access_token }
}

const gwOrg = await mk('gworg')      // a GW student org
const gwStudent = await mk('gwstud')  // verified at GW
const guStudent = await mk('gustud')  // verified at Georgetown
const nobody = await mk('nobody')     // signed in, unverified
const anon = createClient(URL, KEY)
const emails = [gwOrg.email, gwStudent.email, guStudent.email, nobody.email]

await sql`update profiles set kind = 'org', school_domain = 'gwu.edu', claimed_at = now() where id = ${gwOrg.uid}`

// ------------------------------------------------- nobody self-verifies ----
{
  const { error } = await gwStudent.c.from('school_verifications')
    .insert({ user_id: gwStudent.uid, domain: 'gwu.edu' })
  const rows = await sql`select 1 from school_verifications where user_id = ${gwStudent.uid}`
  ok('a client cannot verify itself', rows.length === 0, error?.message || 'it wrote a verification')
}
{
  const { data } = await gwStudent.c.from('school_challenges').select('*')
  ok('a client cannot read pending codes', (data?.length ?? 0) === 0, `${data?.length} rows`)
}

// verify the two students the only way it happens: from the service side
await sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
  values (${gwStudent.uid}, 'gwu.edu', ${'hash-' + gwStudent.uid}, now() + interval '1 year')
  on conflict (user_id) do update set domain = excluded.domain`
await sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
  values (${guStudent.uid}, 'georgetown.edu', ${'hash-' + guStudent.uid}, now() + interval '1 year')
  on conflict (user_id) do update set domain = excluded.domain`

// ----------------------------------------------------- who sees a campus post
const { data: post, error: pErr } = await gwOrg.c.from('posts')
  .insert({ spot_id: 'foggybottom', title: 'GW campus only — chapter meeting', audience: 'school', expires_at: new Date(Date.now() + 36e5).toISOString() })
  .select().single()
if (pErr) { console.log('setup failed:', pErr.message); process.exit(1) }
{
  const [row] = await sql`select audience from posts where id = ${post.id}`
  ok('stored as a campus post (setup)', row.audience === 'school', `stored ${row.audience}`)
}
const sees = async (who, label) => {
  const { data } = await who.from('posts').select('id').eq('id', post.id)
  return (data?.length ?? 0) === 1
}
ok('signed out does NOT see it', !(await sees(anon)), 'visible to the world')
ok('an unverified account does NOT see it', !(await sees(nobody.c)), 'visible without verifying')
ok('a Georgetown student does NOT see it', !(await sees(guStudent.c)), 'leaked across schools')
ok('a verified GW student DOES see it', await sees(gwStudent.c), 'the tier is useless — nobody can read it')
ok('the org still sees its own', await sees(gwOrg.c), 'the author lost its post')

// ------------------------------------------------------- expiry is honoured
{
  await sql`update school_verifications set expires_at = now() - interval '1 day' where user_id = ${gwStudent.uid}`
  ok('an expired verification stops working', !(await sees(gwStudent.c)), 'expired student still reading')
  await sql`update school_verifications set expires_at = now() + interval '1 year' where user_id = ${gwStudent.uid}`
}

// -------------------------------------------- forging your way into a school
{
  const { error } = await guStudent.c.from('school_verifications')
    .update({ domain: 'gwu.edu' }).eq('user_id', guStudent.uid)
  const [row] = await sql`select domain from school_verifications where user_id = ${guStudent.uid}`
  ok('cannot re-point your own verification at another school', row.domain === 'georgetown.edu',
    error?.message || `domain is now ${row.domain}`)
  ok('...and still cannot see the GW post', !(await sees(guStudent.c)), 'crossed schools anyway')
}
{
  // the reader's school is not the test — the AUTHOR's is
  await sql`update profiles set school_domain = 'georgetown.edu' where id = ${gwOrg.uid}`
  ok('moving the org moves who can read it', await sees(guStudent.c), 'the policy ignores the author school')
  ok('...and the GW student loses it', !(await sees(gwStudent.c)), 'stale access after the org moved')
  await sql`update profiles set school_domain = 'gwu.edu' where id = ${gwOrg.uid}`
}

// -------------------------------------------------------- the function API --
const invoke = async (token, body) => {
  const r = await fetch(`${URL}/functions/v1/school-verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
{
  const r = await fetch(`${URL}/functions/v1/school-verify`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start', email: 'someone@gwu.edu' }),
  })
  ok('the function refuses a caller with no session', r.status === 401, `status ${r.status}`)
}
{
  const r = await invoke(nobody.token, { action: 'start', email: 'someone@gmail.com' })
  ok('a non-school address is refused', r.status === 400, `status ${r.status}: ${JSON.stringify(r.body)}`)
}
{
  const r = await invoke(nobody.token, { action: 'start', email: 'someone@evilgwu.edu' })
  ok('a lookalike domain is refused', r.status === 400, `status ${r.status}: ${JSON.stringify(r.body)}`)
}
{
  const r = await invoke(nobody.token, { action: 'confirm', code: '123456' })
  ok('confirming without a pending code is refused', r.status === 400, `status ${r.status}`)
}
{
  // The emailed-code path needs a mailer key. Whatever the answer, it must be
  // an honest one — never a code that silently goes nowhere.
  const r = await invoke(nobody.token, { action: 'start', email: 'someone.else@gwu.edu' })
  const mailerOn = r.body?.status === 'sent'
  ok(mailerOn ? 'the mailer is on and a code was sent' : 'with no mailer configured it says so plainly, and mints nothing',
    mailerOn || (r.status === 503 && r.body?.reason === 'no-mailer'),
    `${r.status}: ${JSON.stringify(r.body)}`)
  const rows = await sql`select 1 from school_challenges where user_id = ${nobody.uid}`
  ok(mailerOn ? '...and a challenge is pending' : '...and no challenge was left behind',
    mailerOn ? rows.length === 1 : rows.length === 0,
    `${rows.length} pending`)
}
{
  // the instant path: this account's own confirmed address IS a school address
  const student = await mk('inst', 'outdc.sv.inst@gwu.edu')
  emails.push(student.email)
  await sql`update auth.users set email_confirmed_at = now() where id = ${student.uid}`
  const r = await invoke(student.token, { action: 'start', email: student.email })
  ok('an account signed in with a school address verifies instantly',
    r.body?.status === 'verified' && r.body?.instant === true, `${r.status}: ${JSON.stringify(r.body)}`)
  const [row] = await sql`select domain from school_verifications where user_id = ${student.uid}`
  ok('...and the domain recorded is the school', row?.domain === 'gwu.edu', `recorded ${row?.domain}`)
  ok('...and that student now sees the GW campus post', await sees(student.c), 'verified but still blind')

  // a second account cannot claim the same mailbox
  const r2 = await invoke(nobody.token, { action: 'start', email: student.email })
  ok('one mailbox verifies one account', r2.status === 409, `status ${r2.status}: ${JSON.stringify(r2.body)}`)

  // and the address itself is never stored in the clear
  const [{ n }] = await sql`select count(*)::int n from school_verifications where email_hash like '%@%'`
  ok('no address is stored in the clear', n === 0, `${n} rows contain an address`)
}

// clean up
await sql`delete from posts where author_id in ${sql(await sql`select id from auth.users where email in ${sql(emails)}`.then((r) => r.map((x) => x.id)))}`.catch(() => {})
await sql`delete from auth.users where email in ${sql(emails)}`
await sql.end()

const bad = results.filter((r) => !r.pass)
console.log(`\n${results.length - bad.length}/${results.length} held`)
process.exit(bad.length ? 1 : 0)
