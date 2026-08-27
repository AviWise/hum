// The moderation view, driven — including the half that matters: an ordinary
// account must not see it at all. node scripts/mod-ui-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4189/out-dc/'
const URL='https://hxmjszgvkynrwscelnzx.supabase.co', KEY='sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX', REF='hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({host:'aws-0-us-east-2.pooler.supabase.com',port:5432,database:'postgres',username:'postgres.hxmjszgvkynrwscelnzx',password:pass,ssl:'require',onnotice:()=>{}})
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const yearsAgo=(n)=>new Date(Date.now()-n*365.25*864e5).toISOString().slice(0,10)
const mk = async (tag) => {
  const c = createClient(URL, KEY, { auth:{persistSession:false} })
  const email=`outdc.modui.${tag}@example.com`
  await c.auth.signUp({ email, password:`modui-${tag}-99`, options:{ data:{ username:`modui.${tag}`, birth_date: yearsAgo(23) } } })
  const { data } = await c.auth.signInWithPassword({ email, password:`modui-${tag}-99` })
  return { c, uid:data.user.id, email, session:data.session, name:`modui.${tag}` }
}
const mod = await mk('mod'), pest = await mk('pest'), victim = await mk('victim')
const emails=[mod.email,pest.email,victim.email]
const b = await chromium.launch({ channel:'chrome' })
const openAs = async (who) => {
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
  await ctx.addInitScript(([k,s])=>localStorage.setItem(k,JSON.stringify(s)), [`sb-${REF}-auth-token`, who.session])
  return ctx.newPage()
}
try {
  await sql`insert into admins (user_id, note) values (${mod.uid}, 'ui test') on conflict do nothing`
  const pair = pest.uid < victim.uid ? {lo:pest.uid,hi:victim.uid} : {lo:victim.uid,hi:pest.uid}
  const { data:t } = await pest.c.from('dm_threads').insert(pair).select().single()
  await pest.c.from('dm_messages').insert({ thread_id:t.id, body:'the reported message itself' })
  await victim.c.from('dm_reports').insert({ thread_id:t.id, note:'wont stop' })
  await pest.c.from('room_messages').insert({ spot_id:'admo', body:'a room message to bury' })
  const [rm] = await sql`select id from room_messages where body = 'a room message to bury'`
  await sql.unsafe('alter table room_reports disable trigger room_reports_guard')
  await sql`insert into room_reports (message_id, reporter_id, ip_hash) values (${rm.id}, ${victim.uid}, 'ip-x')`
  await sql.unsafe('alter table room_reports enable trigger room_reports_guard')

  console.log('— an ordinary account sees nothing —')
  const pv = await openAs(victim)
  await pv.goto(BASE + '#/me', { waitUntil:'networkidle' }); await pv.waitForTimeout(2500)
  ok('no moderation entry on their profile', await pv.locator('.mod-cta').count() === 0)

  console.log('\n— a moderator has the queue —')
  const pm = await openAs(mod)
  await pm.goto(BASE + '#/me', { waitUntil:'networkidle' }); await pm.waitForTimeout(2500)
  ok('the entry is there', await pm.locator('.mod-cta').count() === 1)
  await pm.locator('.mod-cta').click(); await pm.waitForTimeout(2500)
  const text = await pm.locator('.sheet').textContent()
  ok('the reported conversation is listed', text.includes('modui.pest') && text.includes('modui.victim'), text.slice(0,160))
  ok('the reporter is named', text.includes('reported by @modui.victim'))
  ok('the note is shown', text.includes('wont stop'))
  ok('the contents are NOT in the listing', !text.includes('the reported message itself'),
     'private messages were shown without asking')
  ok('the reported room message is listed', text.includes('a room message to bury'))
  await pm.screenshot({ path:'.impeccable/review/moderation-queue.png' })

  console.log('\n— reading takes a second tap —')
  await pm.locator('.pill', { hasText:'Read it' }).click(); await pm.waitForTimeout(2000)
  ok('the thread opens', (await pm.locator('.dm-list').textContent()).includes('the reported message itself'))
  ok('...and says why it is readable', (await pm.locator('.dm-request-note').textContent()).includes('report on it is open'))
  await pm.screenshot({ path:'.impeccable/review/moderation-thread.png' })

  console.log('\n— suspending from the sheet —')
  await pm.locator('.pill-warn', { hasText:'Suspend' }).first().click(); await pm.waitForTimeout(2500)
  const [p] = await sql`select suspended_until from profiles where id = ${pest.uid}`
  ok('the account is suspended', !!p.suspended_until, 'nothing happened')
  const { error } = await pest.c.from('room_messages').insert({ spot_id:'admo', body:'still talking' })
  ok('...and it bites', !!error && /suspend/i.test(error.message), error?.message)
  ok('they appear in the suspended list', (await pm.locator('.sheet').textContent()).includes('modui.pest'))

  console.log('\n— clearing closes the door —')
  await pm.locator('.pill', { hasText:'Clear' }).first().click(); await pm.waitForTimeout(2500)
  const [row] = await sql`select reviewed_at from dm_reports where thread_id = ${t.id}`
  ok('the report is closed', !!row.reviewed_at, 'still open')
  const { data: after } = await mod.c.from('dm_messages').select('body').eq('thread_id', t.id)
  ok('the moderator can no longer read the thread', (after?.length ?? 0) === 0, `${after?.length} messages`)
} finally {
  const uids=[mod.uid,pest.uid,victim.uid]
  await sql`delete from room_messages where author_id = any(${uids})`
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from admins where user_id = any(${uids})`
  await sql`delete from auth.users where email = any(${emails})`
  await sql.end(); await b.close()
}
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
