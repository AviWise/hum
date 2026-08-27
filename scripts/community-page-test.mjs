// The AU COMMUNITY page: the people, not the campus — what it shows, what it
// does not offer, and that the link shipped an hour ago still works.
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const URL2='https://hxmjszgvkynrwscelnzx.supabase.co', KEY2='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX', REF='hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const BASE = process.argv[2] || 'http://localhost:4195/out-dc/'
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const b = await chromium.launch({ channel:'chrome' })
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
await p.goto(BASE + '#/c/american.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(3000)

console.log('— the page —')
ok('it names the school', (await p.locator('.prof-name').textContent()) === 'American')
ok('and its domain', (await p.locator('.prof-user').textContent())?.includes('american.edu'))
const note = await p.locator('.school-note').textContent()
ok('it says nobody owns it', note?.includes('belongs to') && note?.includes('nobody'), note)
ok('and frames it as the people, not the campus', /the people, not the campus/.test(note || ''), note)
ok('it is tagged a community', (await p.locator('.prof-user').textContent())?.includes('Community'))
ok('the groups there are listed', (await p.locator('.sheet, .page').textContent()).includes('AU Test Group'))
const body = await p.locator('.page').textContent()
ok('what is on comes first', body.indexOf('What’s on') < body.indexOf('Groups here'), 'ordering')
ok('the place is a separate section', body.includes('Where this community goes'))
ok('an unverified reader is told what they are missing',
   body.includes('Verify your school address to see campus-only'), body.slice(0, 200))
ok('with spots around campus', await p.locator('.prof-grid .prof-tile').count() >= 6,
   `${await p.locator('.prof-grid .prof-tile').count()} tiles`)
await p.screenshot({ path:'.impeccable/review/school-au.png', fullPage:true })

console.log('\n— nothing here offers ownership —')
const text = await p.locator('.page').textContent()
ok('no claim button', !/claim (this|the) (school|university|page)/i.test(text), text.slice(0,200))
ok('no follow/own affordance for the school itself', await p.locator('.org-claim-cta').count() === 0)

console.log('\n— it links onward, and back —')
await p.locator('.dm-thread').first().click(); await p.waitForTimeout(2000)
ok('a group opens from here', (await p.evaluate(() => location.hash)).startsWith('#/o/'),
   await p.evaluate(() => location.hash))
ok('and the group links back to its school',
   await p.locator('.prof-school-link').count() === 1)
await p.locator('.prof-school-link').click(); await p.waitForTimeout(2000)
ok('which returns here', await p.evaluate(() => location.hash) === '#/c/american.edu',
   await p.evaluate(() => location.hash))

console.log('\n— the older link still works —')
await p.goto(BASE + '#/school/american.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(2500)
ok('#/school/ still lands on the community', (await p.locator('.prof-name').textContent()) === 'American',
   await p.locator('.prof-name').textContent().catch(() => '(nothing)'))

console.log('\n— a school that does not exist —')
await p.goto(BASE + '#/c/notreal.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(2000)
ok('says so plainly', (await p.locator('.empty-line').textContent())?.includes('No school here'))

console.log('\n— a verified student reaches it without knowing a URL —')
{
  const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
  const c = createClient(URL2, KEY2, { auth:{persistSession:false} })
  const email='outdc.commui@example.com'
  await c.auth.signUp({ email, password:'commui-99-a', options:{ data:{ username:'comm.ui', birth_date: yearsAgo(21) } } })
  const { data: signed } = await c.auth.signInWithPassword({ email, password:'commui-99-a' })
  await sql`insert into school_verifications (user_id, domain, email_hash, expires_at)
    values (${signed.user.id}, 'american.edu', ${'h-'+signed.user.id}, now() + interval '1 year')
    on conflict (user_id) do update set domain = 'american.edu'`
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
  await ctx.addInitScript(([k,s2])=>localStorage.setItem(k,JSON.stringify(s2)), [`sb-${REF}-auth-token`, signed.session])
  const pv = await ctx.newPage()
  await pv.goto(BASE + '#/me', { waitUntil:'networkidle' }); await pv.waitForTimeout(3000)
  ok('their community is on their own page', await pv.locator('.comm-cta').count() === 1)
  ok('...named by their school', (await pv.locator('.comm-cta').textContent())?.includes('american.edu'))
  await pv.locator('.comm-cta').click(); await pv.waitForTimeout(2500)
  ok('and it opens', await pv.evaluate(() => location.hash) === '#/c/american.edu',
     await pv.evaluate(() => location.hash))
  ok('it says campus-only is included for them',
     (await pv.locator('.page').textContent()).includes('because you’re verified here'))
  await pv.screenshot({ path:'.impeccable/review/community-au.png', fullPage:true })

  const wide = await b.newPage({ viewport:{width:1512,height:950} })
  await wide.addInitScript(([k,s2])=>localStorage.setItem(k,JSON.stringify(s2)), [`sb-${REF}-auth-token`, signed.session]).catch(()=>{})
  await wide.goto(BASE + '#/', { waitUntil:'networkidle' }); await wide.waitForTimeout(3000)
  console.log(`   desktop rail community entry: ${await wide.locator('.side-community').count()}`)

  await sql`delete from auth.users where email = ${email}`
}
await sql.end()

await b.close()
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
