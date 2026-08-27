// The messaging set: unread signal, reachability, route, thread scent, and the
// profile action row. node scripts/messaging-ui-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4190/hum/'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX', REF='hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth:{persistSession:false} })
  const email=`hum.msgui.${tag}@example.com`
  await c.auth.signUp({ email, password:`msgui-${tag}-99`, options:{ data:{ username:`msgui.${tag}`, full_name:`Msg ${tag}`, birth_date: yearsAgo(23) } } })
  const { data } = await c.auth.signInWithPassword({ email, password:`msgui-${tag}-99` })
  return { c, uid:data.user.id, email, session:data.session }
}
const a = await mk('a'), b2 = await mk('b')
const emails=[a.email,b2.email]
const br = await chromium.launch({ channel:'chrome' })
const openAs = async (who, w=390) => {
  const ctx = await br.newContext({ viewport:{width:w,height:880}, deviceScaleFactor:2 })
  await ctx.addInitScript(([k,s])=>localStorage.setItem(k,JSON.stringify(s)), [`sb-${REF}-auth-token`, who.session])
  return ctx.newPage()
}
try {
  // a talks to b, and b has not read it
  const pair = a.uid < b2.uid ? {lo:a.uid,hi:b2.uid} : {lo:b2.uid,hi:a.uid}
  const { data:t } = await a.c.from('dm_threads').insert(pair).select().single()
  await a.c.from('dm_messages').insert({ thread_id:t.id, body:'are you going to the thing tonight' })

  console.log('— the unread signal —')
  const pb = await openAs(b2)
  await pb.goto(BASE + '#/', { waitUntil:'networkidle' }); await pb.waitForTimeout(3000)
  ok('the phone icon is badged', await pb.locator('.acct-btn.has-unread').count() === 1)
  ok('...and says so to a screen reader',
    /\d+ unread/.test(await pb.locator('.acct-btn[aria-label*="Messages"]').getAttribute('aria-label') || ''),
    await pb.locator('.acct-btn[aria-label*="Messages"]').getAttribute('aria-label'))
  await pb.screenshot({ path:'.impeccable/review/unread-badge.png' })

  console.log('\n— it has a URL now —')
  await pb.locator('.acct-btn[aria-label*="Messages"]').click(); await pb.waitForTimeout(2500)
  ok('opening messages changes the route', await pb.evaluate(()=>location.hash) === '#/messages')
  const row = await pb.locator('.dm-thread').first().textContent()
  ok('the row carries a snippet', row.includes('are you going to the thing'), row)
  ok('...and a timestamp', /\d+[mhdw]|now/.test(row), row)
  ok('...and an unread dot', await pb.locator('.dm-thread.dm-unread').count() === 1)
  await pb.screenshot({ path:'.impeccable/review/thread-list.png' })

  console.log('\n— reading clears it —')
  await pb.locator('.dm-thread').first().click(); await pb.waitForTimeout(2500)
  await pb.locator('.prof-back').click(); await pb.waitForTimeout(1500)
  ok('the thread is no longer unread', await pb.locator('.dm-thread.dm-unread').count() === 0)
  const [rd] = await sql`select read_at from dm_reads where user_id = ${b2.uid} and thread_id = ${t.id}`
  ok('the read is recorded', !!rd, 'nothing stored')

  console.log('\n— back works, because it is a route —')
  await pb.goto(BASE + '#/feed', { waitUntil:'networkidle' }); await pb.waitForTimeout(2000)
  await pb.locator('.acct-btn[aria-label*="Messages"]').click(); await pb.waitForTimeout(2000)
  await pb.goBack(); await pb.waitForTimeout(1500)
  ok('back returns to where you were', await pb.evaluate(()=>location.hash) === '#/feed',
     await pb.evaluate(()=>location.hash))

  console.log('\n— desktop can reach it at all —')
  const pd = await openAs(b2, 1512)
  await pd.goto(BASE + '#/', { waitUntil:'networkidle' }); await pd.waitForTimeout(3000)
  ok('the rail has a Messages entry', await pd.locator('.side-messages').isVisible())
  const order = await pd.evaluate(() => [...document.querySelectorAll('.tabbar .tab-item')]
    .map(e=>({t:e.querySelector('.tab-label').textContent,o:+getComputedStyle(e).order||0}))
    .sort((x,y)=>x.o-y.o).map(x=>x.t).join(' / '))
  ok('the rail order still reads sensibly', order.startsWith('Map / Tonight / Feed / Search / Messages'), order)
  await pd.locator('.side-messages').click(); await pd.waitForTimeout(2000)
  ok('and it opens', await pd.locator('.dm-sheet').count() === 1)
  await pd.screenshot({ path:'.impeccable/review/rail-messages.png' })

  console.log('\n— the profile action row —')
  const pa = await openAs(a)
  await pa.goto(BASE + '#/u/msgui.b', { waitUntil:'networkidle' }); await pa.waitForTimeout(2500)
  ok('actions sit under the identity block', await pa.locator('.prof-actions .prof-msg').count() === 1)
  const geo = await pa.evaluate(() => {
    const head = document.querySelector('.prof-head').getBoundingClientRect()
    const acts = document.querySelector('.prof-actions').getBoundingClientRect()
    const stats = document.querySelector('.prof-stats').getBoundingClientRect()
    return { belowHead: acts.top >= head.bottom - 2, aboveStats: acts.bottom <= stats.top + 2 }
  })
  ok('...below the name and bio', geo.belowHead)
  ok('...and above the numbers', geo.aboveStats)
  const msgBg = await pa.evaluate(() => getComputedStyle(document.querySelector('.prof-msg')).backgroundColor)
  ok('Message reads as the primary action', msgBg !== 'rgba(0, 0, 0, 0)', msgBg)
  await pa.screenshot({ path:'.impeccable/review/profile-actions.png' })
} finally {
  const uids=[a.uid,b2.uid]
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end(); await br.close()
}
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
