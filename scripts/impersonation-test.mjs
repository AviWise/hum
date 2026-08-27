// Can a student end up owning American University? node scripts/impersonation-test.mjs
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const res=[]; const ok=(n,c,d='')=>{res.push(c);console.log(`${c?'  ok  ':' FAIL '} ${n}${c?'':'  <-- '+d}`)}
const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const c = createClient(URL, KEY, { auth:{persistSession:false} })
const email='hum.imp@example.com'
await c.auth.signUp({ email, password:'imp-99-aa', options:{ data:{ username:'imp.test', birth_date: yearsAgo(20) } } })
const { data: s } = await c.auth.signInWithPassword({ email, password:'imp-99-aa' })
try {
  console.log('— claiming the institution itself —')
  for (const name of ['American University', 'american university', 'A.U.', 'AU', 'American',
                      'Official American University', 'american-university', 'The American University Official']) {
    await sql`delete from org_claims where user_id = ${s.user.id}`
    const { error } = await c.from('org_claims').insert({ org_name: name, school_domain: 'american.edu' })
    const rows = await sql`select 1 from org_claims where user_id = ${s.user.id}`
    ok(`"${name}" is refused`, !!error && rows.length === 0, error?.message || 'the claim was filed')
  }
  console.log('\n— but ordinary names are not caught in the net —')
  for (const name of ['Night Owls Film Society', 'Auburn Appreciation Society', 'Beauty Club',
                      'Restaurant Week Crew', 'Mason Jar Collective']) {
    await sql`delete from org_claims where user_id = ${s.user.id}`
    const { error } = await c.from('org_claims').insert({ org_name: name, school_domain: 'american.edu' })
    ok(`"${name}" still goes through`, !error, error?.message)
  }

  console.log('\n— and at the only door orgs are created through —')
  for (const [handle, name] of [['american','American'], ['au','AU Eagles'], ['aueagles','Eagles'], ['official','Official']]) {
    let blocked = false
    try { await sql`insert into orgs (handle, name, school_domain) values (${handle}, ${name}, 'american.edu')` }
    catch (e) { blocked = /institution/.test(e.message) }
    const rows = await sql`select 1 from orgs where handle = ${handle}`
    ok(`@${handle} cannot be created`, blocked && rows.length === 0, 'it was created')
  }
  {
    let made = false
    try {
      await sql`insert into orgs (handle, name, school_domain) values ('impfilm', 'Imp Film Society', 'american.edu')`
      made = true
    } catch (e) { console.log('   unexpected:', e.message) }
    ok('an ordinary group still can be', made)
    await sql`delete from orgs where handle = 'impfilm'`
  }
  {
    // renaming into the institution afterwards must fail too
    await sql`insert into orgs (handle, name, school_domain) values ('impfilm2', 'Imp Film Two', 'american.edu')`
    let blocked = false
    try { await sql`update orgs set name = 'American University' where handle = 'impfilm2'` }
    catch (e) { blocked = /institution/.test(e.message) }
    const [row] = await sql`select name from orgs where handle = 'impfilm2'`
    ok('an existing group cannot rename into the institution', blocked && row.name === 'Imp Film Two', row.name)
    await sql`delete from orgs where handle = 'impfilm2'`
  }

  console.log('\n— there is no way to own a school at all —')
  {
    const { error } = await c.from('schools').update({ name: 'Mine Now' }).eq('domain', 'american.edu')
    const [row] = await sql`select name from schools where domain = 'american.edu'`
    ok('nobody can edit a school', row.name === 'American', error?.message || row.name)
    const { error: e2 } = await c.from('schools').insert({ domain: 'fake.edu', name: 'Fake' })
    ok('nobody can invent one', !!e2, 'a school was created')
    const cols = await sql`select column_name from information_schema.columns where table_name='schools' and table_schema='public'`
    ok('a school has no owner column to grant', !cols.some((x) => /owner|user_id|claimed/.test(x.column_name)),
      cols.map((x)=>x.column_name).join(','))
  }
} finally {
  await sql`delete from org_claims where user_id = ${s.user.id}`
  await sql`delete from auth.users where email = ${email}`
  await sql.end()
}
const bad = res.filter(r=>!r).length
console.log(`\n${res.length-bad}/${res.length} held`)
process.exit(bad?1:0)
