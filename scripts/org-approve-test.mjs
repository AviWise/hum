// A claim, end to end: filed from the app, approved from the review tool, and
// the account can then do the thing approval is supposed to grant — post as
// the group, including campus-only. Cleans up after itself.
//
// node scripts/org-approve-test.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const fail = []
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${cond ? '' : '  <-- ' + detail}`)
  if (!cond) fail.push(name)
}
const run = (...args) => execFileSync('node', ['scripts/org-claims.mjs', ...args], { encoding: 'utf8' })

const email = 'outdc.approve@example.com'
const c = createClient(URL, KEY, { auth: { persistSession: false } })
await c.auth.signUp({ email, password: 'approve-test-99', options: { data: { username: 'approve.test' } } })
const { data: signed } = await c.auth.signInWithPassword({ email, password: 'approve-test-99' })
const uid = signed.user.id

try {
  await sql`delete from org_claims where user_id = ${uid}`
  await sql`update profiles set kind = 'person', school_domain = null, claimed_at = null where id = ${uid}`

  console.log('— filed from the app —')
  const { data: claim, error } = await c.from('org_claims')
    .insert({ org_name: 'Night Owls Film Society', school_domain: 'gwu.edu', evidence: 'president; listed on the GW org directory' })
    .select().single()
  ok('the claim was filed', !error && !!claim, error?.message)

  console.log('\n— it shows up in the queue —')
  const queue = run()
  ok('the review tool lists it', queue.includes('Night Owls Film Society'), queue.slice(0, 200))
  ok('...with the account that filed it', queue.includes('@approve.test'), queue.slice(0, 200))
  ok('...and flags the address mismatch', queue.includes('check the evidence'), queue.slice(0, 300))

  console.log('\n— before approval it can do nothing —')
  {
    const { data } = await c.from('posts')
      .insert({ spot_id: 'foggybottom', title: 'pre-approval campus attempt', audience: 'school', expires_at: new Date(Date.now() + 36e5).toISOString() })
      .select().single()
    const [row] = await sql`select audience from posts where id = ${data.id}`
    ok('a campus post is forced public', row.audience === 'city', `stored ${row.audience}`)
    await sql`delete from posts where id = ${data.id}`
  }

  console.log('\n— approved —')
  const out = run('approve', claim.id)
  ok('the tool reports the grant', out.includes('is now Night Owls Film Society'), out.slice(0, 200))
  const [prof] = await sql`select kind, school_domain, claimed_at from profiles where id = ${uid}`
  ok('the account is an org', prof.kind === 'org', prof.kind)
  ok('...at the school it claimed', prof.school_domain === 'gwu.edu', prof.school_domain)
  ok('...and stamped as claimed', !!prof.claimed_at, 'no claim stamp')
  const [after] = await sql`select reviewed_at, approved from org_claims where id = ${claim.id}`
  ok('the claim is closed as approved', !!after.reviewed_at && after.approved === true, JSON.stringify(after))

  console.log('\n— and now it can post as the group —')
  {
    const { data } = await c.from('posts')
      .insert({ spot_id: 'foggybottom', title: 'members meeting, back room', audience: 'school', expires_at: new Date(Date.now() + 36e5).toISOString() })
      .select().single()
    const [row] = await sql`select audience from posts where id = ${data.id}`
    ok('a campus post stays campus', row.audience === 'school', `stored ${row.audience}`)
    const anon = createClient(URL, KEY)
    const { data: seen } = await anon.from('posts').select('id').eq('id', data.id)
    ok('...and the city still cannot read it', (seen?.length ?? 0) === 0, `${seen?.length} rows`)
    await sql`delete from posts where id = ${data.id}`
  }

  console.log('\n— a second approval attempt is refused —')
  let refused = false
  try { run('approve', claim.id) } catch (e) { refused = /already reviewed/.test(e.stdout || '') }
  ok('it will not re-approve a closed claim', refused, 'it approved twice')
} finally {
  await sql`delete from posts where author_id = ${uid}`
  await sql`delete from org_claims where user_id = ${uid}`
  await sql`delete from auth.users where email = ${email}`
  await sql.end()
}

console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
