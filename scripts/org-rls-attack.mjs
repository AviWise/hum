// Adversarial check on the university-groups slice. The promise being tested:
// nobody can make themselves an org, and a campus-audience post is readable by
// nobody but its author — including another account at the same school.
// node scripts/org-rls-attack.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const results = []
const check = (name, blocked, detail = '') => {
  results.push({ name, blocked })
  console.log(`${blocked ? 'BLOCKED ' : 'LEAKED  '} ${name}${blocked ? '' : '  <-- ' + detail}`)
}

const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `outdc.org.${tag}@example.com`
  await c.auth.signUp({ email, password: `org-test-${tag}-99`, options: { data: { username: `org.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `org-test-${tag}-99` })
  return { c, uid: data.user.id, email }
}
const org = await mk('host')       // a real, approved org
const student = await mk('stud')   // another account at the same school
const anon = createClient(URL, KEY)

// approve the org the only way approval happens: from outside the client
await sql`update profiles set kind = 'org', school_domain = 'demo.edu', claimed_at = now() where id = ${org.uid}`

// ------------------------------------------------------- self-promotion ----
{
  const { error } = await student.c.from('profiles')
    .update({ kind: 'org', school_domain: 'gwu.edu' }).eq('id', student.uid)
  const [row] = await sql`select kind, school_domain from profiles where id = ${student.uid}`
  check('promote yourself to an org', row.kind === 'person' && row.school_domain === null,
    error?.message || `kind is now ${row.kind}`)
}
{
  // the update policy is scoped to your own row, but check the obvious one too
  const { error } = await student.c.from('profiles').update({ kind: 'person', school_domain: null }).eq('id', org.uid)
  const [row] = await sql`select kind from profiles where id = ${org.uid}`
  check('demote someone else', row.kind === 'org', error?.message || 'the org was demoted')
}
{
  const { error } = await student.c.from('profiles').update({ claimed_at: new Date().toISOString() }).eq('id', student.uid)
  const [row] = await sql`select claimed_at from profiles where id = ${student.uid}`
  check('stamp yourself as claimed', row.claimed_at === null, error?.message || 'claim stamp accepted')
}

// ------------------------------------------------------------- audience ----
// The audience checks below only mean anything if the self-promotion attempts
// above actually failed — a student who became an org is *allowed* to post to
// a campus audience, and the test would pass while proving nothing.
{
  const [row] = await sql`select kind from profiles where id = ${student.uid}`
  if (row.kind !== 'person') {
    console.log('\nABORT: the student is no longer a person, so the audience checks are meaningless')
    process.exit(1)
  }
}

// the org files a campus-only post
const { data: campusPost, error: cErr } = await org.c.from('posts')
  .insert({ spot_id: 'brookland', title: 'campus only — members meeting', audience: 'school', expires_at: new Date(Date.now() + 36e5).toISOString() })
  .select().single()
if (cErr) { console.log('setup failed:', cErr.message); process.exit(1) }
{
  const [row] = await sql`select audience from posts where id = ${campusPost.id}`
  check('campus post stored as school (setup)', row.audience === 'school', `stored as ${row.audience}`)
}
{
  const { data } = await anon.from('posts').select('id, title').eq('id', campusPost.id)
  check('read a campus post signed out', (data?.length ?? 0) === 0, `${data?.length} rows visible`)
}
{
  const { data } = await student.c.from('posts').select('id, title').eq('id', campusPost.id)
  check('read a campus post as another student', (data?.length ?? 0) === 0, `${data?.length} rows visible`)
}
{
  const { data } = await org.c.from('posts').select('id').eq('id', campusPost.id)
  check('the author still sees their own campus post (by design)', (data?.length ?? 0) === 1, 'the org lost its own post')
}
{
  // a campus post must not leak through the feed either
  const { data } = await anon.from('posts').select('id').eq('spot_id', 'brookland').eq('audience', 'school')
  check('campus posts absent from a plain listing', (data?.length ?? 0) === 0, `${data?.length} rows visible`)
}
{
  // a person account cannot post to a campus audience at all
  const { data, error } = await student.c.from('posts')
    .insert({ spot_id: 'shaw', title: 'person tries campus', audience: 'school', expires_at: new Date(Date.now() + 36e5).toISOString() })
    .select().single()
  const [row] = data ? await sql`select audience from posts where id = ${data.id}` : [{ audience: null }]
  check('person posts to a campus audience', row.audience === 'city', error?.message || `stored as ${row.audience}`)
}
{
  // and cannot re-label an existing post afterwards
  const { data } = await student.c.from('posts')
    .insert({ spot_id: 'shaw', title: 'person relabels', expires_at: new Date(Date.now() + 36e5).toISOString() })
    .select().single()
  await student.c.from('posts').update({ audience: 'school' }).eq('id', data.id)
  const [row] = await sql`select audience from posts where id = ${data.id}`
  check('person re-labels a post as campus', row.audience === 'city', `stored as ${row.audience}`)
}

// ----------------------------------------------------------- org_claims ----
{
  const { data, error } = await student.c.from('org_claims')
    .insert({ org_name: 'Some Group', school_domain: 'gwu.edu', evidence: 'trust me' })
    .select().single()
  check('filing a claim works at all (setup)', !error && !!data, error?.message)
  if (data) {
    const [row] = await sql`select reviewed_at, approved, user_id from org_claims where id = ${data.id}`
    check('claim lands unreviewed', row.reviewed_at === null && row.approved === null, 'claim arrived pre-approved')
    check('claim is owned by the filer', row.user_id === student.uid, 'claim filed under someone else')
  }
}
{
  const { data, error } = await student.c.from('org_claims')
    .insert({ org_name: 'Pre-approved Group', school_domain: 'gwu.edu', approved: true, reviewed_at: new Date().toISOString() })
    .select().single()
  // the one-open-claim index should stop this outright; if it lands, approval must have been stripped
  let ok = !!error
  if (data) {
    const [row] = await sql`select approved from org_claims where id = ${data.id}`
    ok = row.approved === null
  }
  check('self-approve a claim', ok, 'approved itself')
}
{
  const { error } = await student.c.from('org_claims').update({ approved: true }).eq('user_id', student.uid)
  const rows = await sql`select approved from org_claims where user_id = ${student.uid} and approved is true`
  check('approve your own pending claim', rows.length === 0, error?.message || 'claim approved itself')
}
{
  const { data } = await anon.from('org_claims').select('id, org_name')
  check('read the claim queue signed out', (data?.length ?? 0) === 0, `${data?.length} claims visible`)
}
{
  const { data } = await org.c.from('org_claims').select('id').eq('user_id', student.uid)
  check('read someone else’s claim', (data?.length ?? 0) === 0, `${data?.length} claims visible`)
}

// clean up
await sql`delete from org_claims where user_id in (${org.uid}, ${student.uid})`
await sql`delete from posts where author_id in (${org.uid}, ${student.uid})`
await sql`delete from auth.users where email in (${org.email}, ${student.email})`
await sql.end()

const leaked = results.filter((r) => !r.blocked)
console.log(`\n${results.length - leaked.length}/${results.length} held`)
process.exit(leaked.length ? 1 : 0)
