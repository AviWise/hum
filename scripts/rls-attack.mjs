// Adversarial check on the claim in supa.js: the publishable key is safe
// because RLS carries the permissions. Every attack below must fail.
// node scripts/rls-attack.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const results = []
const check = (name, blocked, detail) => {
  results.push({ name, blocked, detail: String(detail).slice(0, 90) })
  console.log(`${blocked ? 'BLOCKED ' : 'LEAKED  '} ${name}${blocked ? '' : '  <-- ' + detail}`)
}

// two throwaway accounts: the attacker, and the victim they'll impersonate
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `hum.rls.${tag}@example.com`
  await c.auth.signUp({ email, password: `rls-test-${tag}-99`, options: { data: { username: `rls.${tag}` } } })
  const { data } = await c.auth.signInWithPassword({ email, password: `rls-test-${tag}-99` })
  return { c, uid: data.user.id, email }
}
const attacker = await mk('att')
const victim = await mk('vic')
const anon = createClient(URL, KEY)

// the victim owns one real post to aim at
const { data: vpost, error: vErr } = await victim.c.from('posts')
  .insert({ spot_id: 'shaw', title: 'rls victim post', expires_at: new Date(Date.now() + 36e5).toISOString() })
  .select().single()
if (vErr) { console.log('setup failed:', vErr.message); process.exit(1) }

// 1. insert a post as somebody else
{
  const { error } = await attacker.c.from('posts').insert({
    spot_id: 'shaw', title: 'forged as the victim', author_id: victim.uid,
    expires_at: new Date(Date.now() + 36e5).toISOString(),
  }).select().single()
  // guard overwrites author_id with auth.uid(), so a "success" is only a leak
  // if the stored row actually ended up owned by the victim
  let stolen = false
  if (!error) {
    const rows = await sql`select author_id from posts where title = 'forged as the victim'`
    stolen = rows.some((r) => r.author_id === victim.uid)
  }
  check('insert a post as another user', !!error || !stolen, error?.message || 'row landed under the victim')
}

// 2. read a rival's likes
{
  await victim.c.from('likes').insert({ post_id: vpost.id })
  const { data, error } = await anon.from('likes').select('user_id, post_id').eq('post_id', vpost.id)
  // likes are a public social signal (shipped counts UI); what must NOT leak is
  // the ability to read impressions, which is the scoring substrate
  check('read likes (expected open — shipped counts UI)', false, `${data?.length ?? 0} row(s) — deliberate, see report`)
  const imp = await anon.from('impressions').select('*').limit(5)
  check('read impressions (scoring substrate)', !!imp.error || (imp.data?.length ?? 0) === 0, imp.error?.message || `${imp.data?.length} rows`)
}

// 3. write a trophy
{
  const { error } = await attacker.c.from('trophies').insert({ user_id: attacker.uid, contest_id: crypto.randomUUID(), post_id: vpost.id })
  check('write a trophy', !!error, error?.message)
}

// 4-8. the rest of the surface
{
  const { error } = await attacker.c.from('contests').insert({
    scope_type: 'spot', scope_id: 'shaw', audience: 'city',
    starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 6048e5).toISOString(),
  })
  check('open a contest', !!error, error?.message)
}
{
  const { error } = await attacker.c.from('school_verifications').insert({ user_id: attacker.uid, domain: 'georgetown.edu' })
  check('verify yourself as a student', !!error, error?.message)
}
{
  const { error } = await attacker.c.from('impressions').insert({ post_id: vpost.id, viewer_id: victim.uid, surface: 'city' })
  check('log an impression as another viewer', !!error, error?.message)
}
{
  const { data, error } = await attacker.c.from('posts').update({ title: 'defaced' }).eq('id', vpost.id).select()
  check("edit another user's post", !!error || (data?.length ?? 0) === 0, error?.message || 'update applied')
}
{
  const { data, error } = await attacker.c.from('posts').update({ removed_at: new Date().toISOString() }).eq('id', vpost.id).select()
  check("soft-delete another user's post", !!error || (data?.length ?? 0) === 0, error?.message || 'delete applied')
}
{
  const { error } = await attacker.c.from('likes').insert({ post_id: vpost.id, user_id: victim.uid })
  const rows = await sql`select user_id from likes where post_id = ${vpost.id} and user_id = ${attacker.uid}`
  check('like as another user', !!error || rows.length > 0, error?.message || 'stored under the victim')
}
// Expired posts stay READABLE on purpose — a spot keeps the record of who has
// been there. What must never happen is a removed post staying reachable.
{
  await sql`update posts set created_at = now() - interval '3 hours', expires_at = now() - interval '1 minute' where id = ${vpost.id}`
  const { data } = await anon.from('posts').select('id').eq('id', vpost.id)
  check('expired post readable as history (by design)', (data?.length ?? 0) === 1, `${data?.length} rows — history is gone`)
  await sql`update posts set removed_at = now() where id = ${vpost.id}`
  const { data: gone } = await anon.from('posts').select('id').eq('id', vpost.id)
  check('read a removed post', (gone?.length ?? 0) === 0, `${gone?.length} rows visible`)
}

// clean up
await sql`delete from posts where title in ('rls victim post', 'forged as the victim', 'defaced')`
await sql`delete from auth.users where email in (${attacker.email}, ${victim.email})`
await sql.end()

const leaked = results.filter((r) => !r.blocked && !r.name.startsWith('read likes'))
console.log(`\n${results.length - leaked.length}/${results.length} attacks blocked`)
process.exit(leaked.length ? 1 : 0)
