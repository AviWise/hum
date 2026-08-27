// Two people, one code. node scripts/groups-ui-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4197/out-dc/'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX', REF='hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth:{persistSession:false} })
  const email=`outdc.grpui.${tag}@example.com`
  await c.auth.signUp({ email, password:`grpui-${tag}-99`, options:{ data:{ username:`grpui.${tag}`, birth_date: yearsAgo(21) } } })
  const { data } = await c.auth.signInWithPassword({ email, password:`grpui-${tag}-99` })
  return { c, uid:data.user.id, email, session:data.session }
}
const a = await mk('a'), b2 = await mk('b')
const emails=[a.email,b2.email]
// groups are gated on school verification now, so both are AU students
for (const u of [a, b2]) {
  await sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
    values (${u.uid}, 'american.edu', ${'h-'+u.uid}, now() + interval '1 year')
    on conflict (user_id) do update set domain = 'american.edu'`
}
const br = await chromium.launch({ channel:'chrome' })
const openAs = async (who) => {
  const ctx = await br.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
  await ctx.addInitScript(([k,s])=>localStorage.setItem(k,JSON.stringify(s)), [`sb-${REF}-auth-token`, who.session])
  const p = await ctx.newPage()
  await p.goto(BASE + '#/messages', { waitUntil:'networkidle' })
  await p.waitForTimeout(3000)
  await p.locator('.pill', { hasText:'Groups' }).click()
  await p.waitForTimeout(1200)
  return p
}
let code
try {
  console.log('— starting one —')
  const pa = await openAs(a)
  ok('it says how you get in', (await pa.locator('.aud-note').textContent())?.includes('aren’t searchable'))
  await pa.locator('.pill', { hasText:'Start one' }).click(); await pa.waitForTimeout(500)
  await pa.locator('#grp-name').fill('4th floor')
  await pa.locator('button[type="submit"]').click(); await pa.waitForTimeout(2500)
  ok('the group appears', (await pa.locator('.dm-thread').textContent())?.includes('4th floor'))
  const [row] = await sql`select join_code from groups where name = '4th floor'`
  code = row.join_code
  ok('the code is shown so it can be passed on', (await pa.locator('.dm-snippet').textContent())?.includes(code), code)
  ok('and the school it belongs to', (await pa.locator('.dm-snippet').textContent())?.includes('american.edu'))
  await pa.screenshot({ path:'.impeccable/review/groups-list.png' })

  console.log('\n— the other person, with the code —')
  const pb = await openAs(b2)
  ok('they see no groups at all', await pb.locator('.dm-thread').count() === 0)
  await pb.locator('#grp-code').fill(code)
  await pb.locator('button[type="submit"]').click(); await pb.waitForTimeout(2500)
  ok('asking does not put them in yet', await pb.locator('.dm-thread').count() === 0,
     'the code let them straight in')
  const asked = await pb.locator('.form-err, .toast').textContent().catch(() => '')
  console.log(`   after the code: "${(await pb.locator('.toast').textContent().catch(()=>'')).trim() || asked.trim()}"`)

  console.log('\n— somebody inside says yes —')
  await pa.reload({ waitUntil:'networkidle' }); await pa.waitForTimeout(2500)
  await pa.locator('.pill', { hasText:'Groups' }).click(); await pa.waitForTimeout(1200)
  ok('the list flags that someone is asking',
     (await pa.locator('.dm-snippet').textContent())?.includes('asking to join'))
  await pa.locator('.dm-thread').click(); await pa.waitForTimeout(1500)
  ok('the request is shown inside', await pa.locator('.grp-request').count() === 1)
  await pa.screenshot({ path:'.impeccable/review/groups-request.png' })
  await pa.locator('.pill', { hasText:'Let them in' }).click(); await pa.waitForTimeout(2500)
  await pb.reload({ waitUntil:'networkidle' }); await pb.waitForTimeout(2500)
  await pb.locator('.pill', { hasText:'Groups' }).click(); await pb.waitForTimeout(1500)
  ok('now they are in', (await pb.locator('.dm-thread').textContent())?.includes('4th floor'))

  console.log('\n— talking —')
  await pa.locator('.room-form input').fill('anyone going to suns tonight')
  await pa.locator('.room-send').click(); await pa.waitForTimeout(2000)
  await pb.locator('.dm-thread').click(); await pb.waitForTimeout(2500)
  ok('it arrives for the other member', (await pb.locator('.dm-list').textContent())?.includes('suns tonight'))
  ok('and the room says how long it keeps things',
     (await pb.locator('.dm-request-note').textContent())?.includes('clear after a week'))
  await pb.screenshot({ path:'.impeccable/review/groups-thread.png' })

  console.log('\n— leaving —')
  await pb.locator('.dm-act', { hasText:'leave' }).click(); await pb.waitForTimeout(2500)
  const rows = await sql`select 1 from group_members m join groups g on g.id=m.group_id where g.join_code=${code} and m.user_id=${b2.uid}`
  ok('they are out', rows.length === 0, 'still a member')
  ok('and the group is gone from their list', await pb.locator('.dm-thread').count() === 0)
} finally {
  if (code) await sql`delete from groups where join_code = ${code}`
  await sql`delete from school_verifications where user_id = any(${[a.uid, b2.uid]})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end(); await br.close()
}
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
