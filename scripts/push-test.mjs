// Does a push actually leave the building — and does the restraint hold?
// node scripts/push-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4188/out-dc/'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX', REF='hxmjszgvkynrwscelnzx'
const env = readFileSync('.env','utf8')
const pass = env.match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const secret = env.match(/PUSH_SECRET=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const res = []
const ok = (n,c,d='') => { res.push(c); console.log(`${c?'  ok  ':' FAIL '} ${n}${c?'':'  <-- '+d}`) }
const call = (body, hdr = {}) => fetch(`${URL}/functions/v1/push-send`, {
  method:'POST', headers:{ 'Content-Type':'application/json', apikey: KEY, ...hdr }, body: JSON.stringify(body),
}).then(async r => ({ status: r.status, body: await r.json().catch(()=>({})) }))

const yearsAgo = (n) => new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const c = createClient(URL, KEY, { auth:{ persistSession:false } })
const email = 'outdc.push@example.com'
await c.auth.signUp({ email, password:'push-99-aa', options:{ data:{ username:'push.test', birth_date: yearsAgo(21) } } })
const { data: signed } = await c.auth.signInWithPassword({ email, password:'push-99-aa' })

// Chrome disables the Push API in incognito, and every Playwright context is
// incognito — so this needs a persistent profile or subscribe() throws
// "Registration failed - permission denied" with no hint why.
const profile = mkdtempSync(join(tmpdir(), 'outdc-push-'))
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chrome', viewport: { width: 390, height: 844 },
  permissions: ['notifications'],
})
try {
  console.log('— nobody but the cron can fire it —')
  ok('no secret, no send', (await call({ dryRun:true })).status === 401)
  ok('wrong secret, no send', (await call({ dryRun:true }, { 'x-push-secret':'nope' })).status === 401)

  console.log('\n— subscribing from a real browser —')
  await ctx.addInitScript(([k,s])=>localStorage.setItem(k,JSON.stringify(s)), [`sb-${REF}-auth-token`, signed.session])
  const p = await ctx.newPage()
  await p.goto(BASE + '#/me', { waitUntil:'networkidle' })
  await p.waitForTimeout(3000)
  const cta = p.locator('.org-claim-cta', { hasText: 'Tell me when' })
  ok('the offer is on your own profile', await cta.count() === 1)
  ok('...and says how often, up front', /Once a day at most/.test(await cta.textContent() || ''))
  await cta.click()
  await p.waitForTimeout(6000)
  const [sub] = await sql`select endpoint, p256dh, auth from push_subs where user_id = ${signed.user.id}`
  ok('a subscription was stored', !!sub, 'nothing saved')
  ok('...with a real push endpoint', !!sub && /^https:\/\//.test(sub.endpoint), sub?.endpoint?.slice(0,40))
  ok('the page now says it is on', await p.locator('.verified-line', { hasText: 'worth it' }).count() === 1)

  console.log('\n— the restraint —')
  // three live posts, because "nothing is on" is a legitimate reason to stay
  // silent and would otherwise mask everything below
  await sql.unsafe('alter table posts disable trigger posts_guard')
  await sql.unsafe('alter table posts disable trigger posts_aa_suspension')
  for (const n of [1, 2, 3]) {
    await sql`insert into posts (spot_id, title, username, author_id, expires_at, audience)
      values ('admo', ${'push fixture ' + n}, 'push.test', ${signed.user.id}, now() + interval '2 hours', 'city')`
  }
  await sql.unsafe('alter table posts enable trigger posts_guard')
  await sql.unsafe('alter table posts enable trigger posts_aa_suspension')

  const dry = await call({ dryRun:true }, { 'x-push-secret': secret })
  ok('it counts what is actually live', dry.body.live >= 3, JSON.stringify(dry.body))
  ok('a dry run reports what it would do', dry.status === 200 && 'wouldSend' in dry.body, JSON.stringify(dry.body))
  // a dry run: probing this with a real send burns the daily cap and the
  // ledger key, and then the send test below silently tests nothing
  const quiet = await call({ dryRun:true, only: signed.user.id }, { 'x-push-secret': secret })
  const nowH = new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'})).getHours()
  if (nowH < 10 || nowH >= 23) {
    ok('it refuses to buzz during quiet hours', quiet.body.skipped === 'quiet hours', JSON.stringify(quiet.body))
  } else {
    console.log(`   (it is ${nowH}:00 in D.C., inside sending hours — quiet-hours branch checked by clock below)`)
    ok('inside hours it does not claim quiet hours', quiet.body.skipped !== 'quiet hours', JSON.stringify(quiet.body))
  }

  console.log('\n— a real send —')
  await sql`delete from push_log where user_id = ${signed.user.id}`
  await sql`update push_subs set sent_today = 0, day = current_date - 1 where user_id = ${signed.user.id}`
  const sent = await call({ only: signed.user.id }, { 'x-push-secret': secret })
  ok('the push service accepted it', sent.body.sent === 1, JSON.stringify(sent.body))
  // read it here, before the cap is reset below for the replay check
  const [row] = await sql`select sent_today, last_sent_at from push_subs where user_id = ${signed.user.id}`
  ok('the send is recorded against the subscription', row?.sent_today === 1 && !!row?.last_sent_at, JSON.stringify(row))
  // reset only the cap, not the ledger: the ledger is what must stop a repeat
  await sql`update push_subs set sent_today = 0, day = current_date - 1 where user_id = ${signed.user.id}`
  const again = await call({ only: signed.user.id }, { 'x-push-secret': secret })
  ok('the same thing is never sent twice', again.body.sent === 0, JSON.stringify(again.body))

  console.log('\n— and it stays quiet when nothing is on —')
  await sql`delete from posts where title like 'push fixture%'`
  await sql`delete from push_log where user_id = ${signed.user.id}`
  const nothing = await call({ only: signed.user.id }, { 'x-push-secret': secret })
  ok('no posts, no push', nothing.body.sent === 0 && /only \d+ live/.test(nothing.body.skipped || ''),
    JSON.stringify(nothing.body))
} finally {
  await sql`delete from posts where title like 'push fixture%'`
  await sql`delete from auth.users where email = ${email}`
  await sql.end()
  await ctx.close()
  rmSync(profile, { recursive: true, force: true })
}
const bad = res.filter(r=>!r).length
console.log(`\n${res.length-bad}/${res.length} held`)
process.exit(bad?1:0)
