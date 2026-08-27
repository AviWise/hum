// Membership, attacked.
//
// The claims under test: you cannot post as a group you are not in, you cannot
// add yourself to one, the roster is not public, an org post shows the group
// and not the person who wrote it — while still recording who wrote it — and
// the campus tier now follows the ORG's school.
//
// node scripts/org-membership-test.mjs
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
  const email = `outdc.mem.${tag}@example.com`
  await c.auth.signUp({ email, password: `mem-${tag}-99`, options: { data: { username: `mem.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `mem-${tag}-99` })
  return { c, uid: data.user.id, email }
}

const owner = await mk('owner')     // runs the GW org
const editor = await mk('editor')   // also in it
const outsider = await mk('out')    // in nothing
const gwStudent = await mk('gwstud')
const anon = createClient(URL, KEY)
const emails = [owner.email, editor.email, outsider.email, gwStudent.email]
let orgId

try {
  const [org] = await sql`insert into orgs (handle, name, school_domain, claimed_at)
    values ('memtest', 'Membership Test Society', 'gwu.edu', now())
    on conflict (handle) do update set name = excluded.name returning id`
  orgId = org.id
  await sql`insert into org_members (org_id, user_id, role) values
    (${orgId}, ${owner.uid}, 'owner'), (${orgId}, ${editor.uid}, 'editor')
    on conflict do nothing`
  await sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
    values (${gwStudent.uid}, 'gwu.edu', ${'h-' + gwStudent.uid}, now() + interval '1 year')
    on conflict (user_id) do update set domain = excluded.domain`

  console.log('— posting as a group —')
  {
    const { error } = await outsider.c.from('posts').insert({
      spot_id: 'foggybottom', title: 'outsider posting as the group', org_id: orgId,
      expires_at: new Date(Date.now() + 36e5).toISOString(),
    })
    const rows = await sql`select 1 from posts where title = 'outsider posting as the group'`
    ok('a non-member cannot post as the group', !!error && rows.length === 0, 'the post landed')
  }
  {
    const { data, error } = await editor.c.from('posts').insert({
      spot_id: 'foggybottom', title: 'editor posting as the group', org_id: orgId,
      expires_at: new Date(Date.now() + 36e5).toISOString(),
    }).select().single()
    ok('a member can', !error && !!data, error?.message)
    if (data) {
      const [row] = await sql`select username, author_id, org_id from posts where id = ${data.id}`
      ok('the byline is the group, not the person', row.username === 'memtest', row.username)
      ok('...but the person is still recorded', row.author_id === editor.uid, 'author lost')
      ok('...and the public payload never names them',
        !JSON.stringify(data).includes('mem.editor'), 'the member handle leaked to the client')
    }
  }

  console.log('\n— the campus tier follows the org —')
  {
    const { data } = await owner.c.from('posts').insert({
      spot_id: 'foggybottom', title: 'campus only via org', org_id: orgId, audience: 'school',
      expires_at: new Date(Date.now() + 36e5).toISOString(),
    }).select().single()
    const [row] = await sql`select audience from posts where id = ${data.id}`
    ok('a member may post campus-only', row.audience === 'school', `stored ${row.audience}`)
    const seen = async (cl) => ((await cl.from('posts').select('id').eq('id', data.id)).data?.length ?? 0) === 1
    ok('signed out cannot read it', !(await seen(anon)), 'public')
    ok('an unverified account cannot', !(await seen(outsider.c)), 'leaked')
    ok('a verified GW student can', await seen(gwStudent.c), 'nobody can read it')
    await sql`update orgs set school_domain = 'howard.edu' where id = ${orgId}`
    ok('moving the org moves who can read it', !(await seen(gwStudent.c)), 'stale access')
    await sql`update orgs set school_domain = 'gwu.edu' where id = ${orgId}`
  }
  {
    const { data } = await outsider.c.from('posts').insert({
      spot_id: 'shaw', title: 'person tries campus without an org', audience: 'school',
      expires_at: new Date(Date.now() + 36e5).toISOString(),
    }).select().single()
    const [row] = await sql`select audience from posts where id = ${data.id}`
    ok('a person with no org is forced public', row.audience === 'city', `stored ${row.audience}`)
  }

  console.log('\n— joining a group —')
  {
    const { error } = await outsider.c.from('org_members')
      .insert({ org_id: orgId, user_id: outsider.uid, role: 'owner' })
    const rows = await sql`select 1 from org_members where org_id = ${orgId} and user_id = ${outsider.uid}`
    ok('you cannot add yourself', !!error && rows.length === 0, 'they joined')
  }
  {
    const { error } = await editor.c.from('org_members')
      .update({ role: 'owner' }).eq('org_id', orgId).eq('user_id', editor.uid)
    const [row] = await sql`select role from org_members where org_id = ${orgId} and user_id = ${editor.uid}`
    ok('an editor cannot promote themselves', row.role === 'editor', error?.message || `role is ${row.role}`)
  }
  {
    const { error } = await outsider.c.from('org_members').delete().eq('org_id', orgId)
    const rows = await sql`select 1 from org_members where org_id = ${orgId}`
    ok('an outsider cannot empty the roster', rows.length === 2, error?.message || `${rows.length} left`)
  }

  console.log('\n— who can see the roster —')
  {
    // an outsider must be FILTERED, not errored at: a policy that throws looks
    // identical to a policy that works, and hides real breakage
    const { data, error: aErr } = await anon.from('org_members').select('user_id')
    ok('signed out sees no roster', !aErr && (data?.length ?? -1) === 0, aErr?.message || `${data?.length} rows`)
    const { data: o, error: oErr } = await outsider.c.from('org_members').select('user_id').eq('org_id', orgId)
    ok('an outsider sees no roster', !oErr && (o?.length ?? -1) === 0, oErr?.message || `${o?.length} rows`)
    const { data: m, error: mErr } = await editor.c.from('org_members').select('user_id').eq('org_id', orgId)
    ok('a member sees the roster', !mErr && (m?.length ?? 0) === 2, mErr?.message || `${m?.length} rows`)
  }

  console.log('\n— the org itself —')
  {
    const { data } = await anon.from('orgs').select('handle, name').eq('id', orgId)
    ok('the group is publicly readable', (data?.length ?? 0) === 1, 'invisible')
    const { error } = await outsider.c.from('orgs')
      .insert({ handle: 'selfmade', name: 'Self Made', school_domain: 'gwu.edu' })
    const rows = await sql`select 1 from orgs where handle = 'selfmade'`
    ok('nobody can mint a group from the app', !!error && rows.length === 0, 'a group was created')
    const { error: uErr } = await owner.c.from('orgs').update({ school_domain: 'howard.edu' }).eq('id', orgId)
    const [row] = await sql`select school_domain from orgs where id = ${orgId}`
    ok('not even an owner can move their group to another school',
      row.school_domain === 'gwu.edu', uErr?.message || `now ${row.school_domain}`)
  }
} finally {
  const uids = [owner.uid, editor.uid, outsider.uid, gwStudent.uid]
  await sql`delete from posts where author_id = any(${uids})`
  if (orgId) await sql`delete from orgs where id = ${orgId}`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}

const bad = results.filter((r) => !r).length
console.log(`\n${results.length - bad}/${results.length} held`)
process.exit(bad ? 1 : 0)
