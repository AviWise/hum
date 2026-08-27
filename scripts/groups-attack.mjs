// Private groups, attacked.
//
// The promises: three gates to get in — the code, somebody's approval, and a
// verified address at that school — nothing to search or enumerate, a
// non-member reads nothing, leaving is yours alone, and nothing in the schema
// records a dorm or a floor.
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const res=[]; const ok=(n,c,d='')=>{res.push(c);console.log(`${c?'  ok  ':' FAIL '} ${n}${c?'':'  <-- '+d}`)}
const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const mk = async (tag, years=21) => {
  const c = createClient(URL, KEY, { auth:{persistSession:false} })
  const email=`hum.grp.${tag}@example.com`
  await c.auth.signUp({ email, password:`grp-${tag}-99`, options:{ data:{ username:`grp.${tag}`, birth_date: yearsAgo(years) } } })
  const { data } = await c.auth.signInWithPassword({ email, password:`grp-${tag}-99` })
  return { c, uid:data.user.id, email }
}
const ana = await mk('ana'), ben = await mk('ben'), nosy = await mk('nosy'), kid = await mk('kid', 16)
const other = await mk('other')          // verified at a DIFFERENT school
const unver = await mk('unver')          // adult, but never verified anywhere
const emails=[ana.email,ben.email,nosy.email,kid.email,other.email,unver.email]
// verification is now a gate, so hand it out the way the function would
const verify = (uid, dom) => sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
  values (${uid}, ${dom}, ${'h-'+uid}, now() + interval '1 year')
  on conflict (user_id) do update set domain = excluded.domain`
await verify(ana.uid, 'american.edu')
await verify(ben.uid, 'american.edu')
await verify(nosy.uid, 'american.edu')
await verify(kid.uid, 'american.edu')
await verify(other.uid, 'gwu.edu')
const anon = createClient(URL, KEY)
let gid, code
try {
  console.log('— making one —')
  {
    const { data, error } = await ana.c.rpc('create_group', { group_name: '4th floor' })
    ok('a signed-in adult can make a group', !error && !!data?.id, error?.message)
    gid = data.id; code = data.join_code
    ok('it hands back a code', /^[A-Z0-9]{6}$/.test(code || ''), code)
    ok('...with no lookalike characters in it', !/[OIl01]/.test(code), code)
    const [row] = await sql`select role from group_members where group_id = ${gid} and user_id = ${ana.uid}`
    ok('the maker is inside it', row?.role === 'owner', row?.role)
  }
  {
    const { error } = await kid.c.rpc('create_group', { group_name: 'under age' })
    ok('under 18 cannot make one', !!error && /18/.test(error.message), error?.message)
  }
  {
    const { error } = await unver.c.rpc('create_group', { group_name: 'no school' })
    ok('an unverified account cannot make one', !!error && /verify/.test(error.message), error?.message)
  }
  {
    const [row] = await sql`select school_domain from groups where id = ${gid}`
    ok('the group belongs to the maker’s school', row.school_domain === 'american.edu', row.school_domain)
  }

  console.log('\n— a group is not an org and cannot pretend to be one —')
  {
    const { error } = await ana.c.rpc('create_group', { group_name: 'American University' })
    ok('a group cannot take the institution’s name', !!error, 'it was created')
    const { error: e2 } = await ana.c.rpc('create_group', { group_name: 'AU Test Group' })
    ok('nor a real student org’s name at that school', !!e2 && /already goes by/.test(e2.message), e2?.message)
    const { error: e3 } = await ana.c.rpc('create_group', { group_name: 'Tuesday climbing' })
    ok('an ordinary name is fine', !e3, e3?.message)
    await sql`delete from groups where name = 'Tuesday climbing'`
  }
  {
    // the structural half: a group has no route to the map at all
    const cols = await sql`select column_name from information_schema.columns
      where table_schema='public' and table_name='group_messages'`
    ok('a group message has no spot, no map, no audience',
      !cols.some((c) => /spot|lat|lng|audience|place/i.test(c.column_name)),
      cols.map((c)=>c.column_name).join(','))
    const [pub] = await sql`select count(*)::int n from pg_policy p join pg_class c on c.oid=p.polrelid
      where c.relname='orgs' and p.polcmd='r'`
    ok('an org is world-readable and cannot be hidden', pub.n >= 1, 'orgs have no public read policy')
  }

  console.log('\n— there is nothing to find —')
  {
    const { data } = await nosy.c.from('groups').select('id, name, join_code')
    ok('a stranger cannot list groups', (data?.length ?? 0) === 0, `${data?.length} visible`)
    const { data: byName } = await nosy.c.from('groups').select('id').ilike('name', '%floor%')
    ok('...nor search them by name', (byName?.length ?? 0) === 0, `${byName?.length} found`)
    const { data: a2 } = await anon.from('groups').select('id')
    ok('signed out sees none', (a2?.length ?? 0) === 0, `${a2?.length}`)
    const { data: mem } = await nosy.c.from('group_members').select('user_id').eq('group_id', gid)
    ok('the roster is invisible from outside', (mem?.length ?? 0) === 0, `${mem?.length}`)
  }
  {
    const { error } = await nosy.c.from('group_members').insert({ group_id: gid, user_id: nosy.uid })
    const rows = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${nosy.uid}`
    ok('you cannot add yourself directly', !!error && rows.length === 0, 'they joined')
  }
  {
    const { error } = await nosy.c.rpc('request_group', { code: 'ZZZZZZ' })
    ok('a wrong code is refused', !!error, 'a bad code worked')
    ok('...without saying whether it exists',
      !!error && /does not work/.test(error.message) && !/full|member|exist|school/i.test(error.message), error?.message)
  }

  console.log('\n— the code alone is not enough —')
  {
    const { error } = await other.c.rpc('request_group', { code })
    ok('someone from another school cannot use the code', !!error, 'a GW student got in at AU')
    ok('...and is told nothing about why', /does not work/.test(error?.message || ''), error?.message)
  }
  {
    const { error } = await unver.c.rpc('request_group', { code })
    ok('an unverified account cannot use the code', !!error, 'they got in unverified')
  }
  {
    const { data, error } = await ben.c.rpc('request_group', { code })
    ok('a verified classmate can ask', !error && data?.status === 'asked', error?.message || JSON.stringify(data))
    const rows = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${ben.uid}`
    ok('...but asking is not joining', rows.length === 0, 'the code let them straight in')
    const { data: seen } = await ben.c.from('groups').select('name').eq('id', gid)
    ok('...and they still cannot read the group', (seen?.length ?? 0) === 0, `${seen?.length} visible`)
  }

  console.log('\n— somebody has to say yes —')
  {
    const [req] = await sql`select id from group_join_requests where group_id = ${gid} and user_id = ${ben.uid}`
    const { error } = await nosy.c.rpc('decide_group_request', { request: req.id, approve: true })
    const rows = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${ben.uid}`
    ok('an outsider cannot approve', !!error && rows.length === 0, 'an outsider let them in')
    const { error: e2 } = await ben.c.rpc('decide_group_request', { request: req.id, approve: true })
    const rows2 = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${ben.uid}`
    ok('you cannot approve yourself', !!e2 && rows2.length === 0, 'they approved themselves')
    const { error: e3 } = await ana.c.rpc('decide_group_request', { request: req.id, approve: true })
    ok('a member can', !e3, e3?.message)
    const { data } = await ben.c.from('groups').select('name').eq('id', gid)
    ok('and then they are in', data?.[0]?.name === '4th floor', JSON.stringify(data))
  }
  {
    const { data, error } = await ana.c.from('group_messages').insert({ group_id: gid, body: 'anyone going out tonight' }).select().single()
    ok('a member can speak', !error && !!data, error?.message)
    const { data: seen } = await ben.c.from('group_messages').select('body').eq('group_id', gid)
    ok('another member hears it', seen?.[0]?.body?.includes('going out'), JSON.stringify(seen))
    const { data: not } = await nosy.c.from('group_messages').select('body').eq('group_id', gid)
    ok('an outsider hears nothing', (not?.length ?? 0) === 0, `${not?.length} messages`)
  }
  {
    const { error } = await nosy.c.from('group_messages').insert({ group_id: gid, body: 'butting in' })
    ok('an outsider cannot speak', !!error, 'they posted')
  }
  {
    const { error } = await ana.c.from('group_messages').insert({ group_id: gid, body: 'come to freestuff.com' })
    ok('links are refused', !!error, 'a link went in')
  }

  console.log('\n— leaving —')
  {
    await ben.c.from('group_members').delete().eq('group_id', gid).eq('user_id', ben.uid)
    const rows = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${ben.uid}`
    ok('you can leave your own group', rows.length === 0, 'still a member')
    const { data } = await ben.c.from('group_messages').select('body').eq('group_id', gid)
    ok('...and stop hearing it immediately', (data?.length ?? 0) === 0, `${data?.length} still readable`)
  }
  {
    await sql`insert into group_members (group_id, user_id) values (${gid}, ${ben.uid}) on conflict do nothing`
    const { error } = await ben.c.from('group_members').delete().eq('group_id', gid).eq('user_id', ana.uid)
    const rows = await sql`select 1 from group_members where group_id = ${gid} and user_id = ${ana.uid}`
    ok('you cannot throw someone else out', rows.length === 1, error?.message || 'they were removed')
  }

  console.log('\n— and no floor is recorded anywhere —')
  {
    const cols = await sql`select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name in ('groups','group_members','group_messages')`
    const names = cols.map((c) => c.column_name).join(',')
    ok('no dorm, floor, building or room column', !/dorm|floor|building|room_no|residence/i.test(names), names)
    ok('a school is recorded, which is an institution not an address',
      /school_domain/.test(names), names)
  }
} finally {
  if (gid) await sql`delete from groups where id = ${gid}`
  await sql`delete from school_verifications where user_id = any(${[ana.uid,ben.uid,nosy.uid,kid.uid,other.uid,unver.uid]})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end()
}
const bad = res.filter(r=>!r).length
console.log(`\n${res.length-bad}/${res.length} held`)
process.exit(bad?1:0)
