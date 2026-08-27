// Rooms and messages, driven as two people in two browsers.
//
// node scripts/chat-ui-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4184/out-dc/'
const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const REF = 'hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const fail = []
const ok = (l, c, d = '') => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}${c ? '' : '  <-- ' + d}`); if (!c) fail.push(l) }

// signup collects a date of birth now, so accounts arrive with an age already
// declared — which is the whole point: messaging needs BOTH sides known, and
// asking only at first use meant nobody could be messaged on day one.
const yearsAgo = (n) => new Date(Date.now() - n * 365.25 * 864e5).toISOString().slice(0, 10)
const mk = async (tag, years) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `outdc.chatui.${tag}@example.com`
  const data = { username: `chatui.${tag}` }
  if (years) data.birth_date = yearsAgo(years)
  await c.auth.signUp({ email, password: `chatui-${tag}-99`, options: { data } })
  const { data: d } = await c.auth.signInWithPassword({ email, password: `chatui-${tag}-99` })
  return { email, uid: d.user.id, session: d.session }
}

const a = await mk('a', 22)
const b = await mk('b', 25)
const undeclared = await mk('c')   // signed up before the question existed
const browser = await chromium.launch({ channel: 'chrome' })
const openAs = async (who) => {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await p.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [`sb-${REF}-auth-token`, who.session])
  return p
}

try {
  console.log('— the room at a spot —')
  const pa = await openAs(a)
  await pa.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
  await pa.waitForTimeout(3000)
  ok('the room is on the spot sheet', await pa.locator('.room').count() === 1)
  ok('it says who can see it', (await pa.locator('.room-note').textContent())?.includes('everyone here'))
  await pa.locator('.room-form input').fill('line is about ten deep, moving fast')
  await pa.locator('.room-send').click()
  await pa.waitForTimeout(2000)
  ok('the message appears', (await pa.locator('.room-msg').count()) >= 1)
  await pa.screenshot({ path: '.impeccable/review/room-390.png' })

  const pb = await openAs(b)
  await pb.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
  await pb.waitForTimeout(3000)
  ok('the other person sees it too', (await pb.locator('.room-msg').textContent())?.includes('ten deep'))

  console.log('\n— it arrives live —')
  await pb.locator('.room-form input').fill('just got here, no cover')
  await pb.locator('.room-send').click()
  await pa.waitForTimeout(3000)
  ok('a new message lands without a reload', (await pa.locator('.room-list').textContent())?.includes('no cover'))

  console.log('\n— links are refused, and it says so —')
  await pa.locator('.room-form input').fill('free drinks at cheapdrinks.com tonight')
  await pa.locator('.room-send').click()
  await pa.waitForTimeout(1800)
  ok('the room refuses a link', (await pa.locator('.form-err').textContent().catch(() => '') || '').includes('no links'))

  console.log('\n— an account with no declared age is asked —')
  {
    const pc = await openAs(undeclared)
    await pc.goto(BASE + '#/', { waitUntil: 'networkidle' })
    await pc.waitForTimeout(2500)
    await pc.locator('.acct-btn[aria-label="Messages"]').click()
    await pc.waitForTimeout(1500)
    ok('it asks how old they are', (await pc.locator('.sheet-name').textContent())?.includes('When were you born'))
    ok('...and says the map stays open either way',
      (await pc.locator('.post-sub').textContent())?.includes('stays open'))
    await pc.screenshot({ path: '.impeccable/review/age-gate.png' })
    await pc.locator('#age-dob').fill(yearsAgo(16))
    await pc.locator('button[type="submit"]').click()
    await pc.waitForTimeout(2500)
    ok('under 18 is told messaging waits', (await pc.locator('.sheet-name').textContent())?.includes('18+'))
    ok('...and the rest of the app is offered, not withdrawn',
      (await pc.locator('.post-sub').textContent())?.includes('rest of out. is yours'))
    await pc.screenshot({ path: '.impeccable/review/age-too-young.png' })
    const [row] = await sql`select public.is_adult(${undeclared.uid}) as adult`
    ok('the declaration is recorded either way', row.adult === false, 'nothing recorded')
    await pc.close()
  }

  console.log('\n— an adult goes straight through —')
  await pa.goto(BASE + `#/u/chatui.b`, { waitUntil: 'networkidle' })
  await pa.waitForTimeout(2500)
  ok('there is a Message button on their profile', await pa.locator('.prof-msg').count() === 1)
  await pa.locator('.prof-msg').click()
  await pa.waitForTimeout(3000)
  ok('no age question — it was answered at signup', await pa.locator('#age-dob').count() === 0)

  console.log('\n— a message request —')
  await pa.locator('.room-form input').fill('hey — were you at Suns last night?')
  await pa.locator('.room-send').click()
  await pa.waitForTimeout(2000)
  ok('the first message sends', (await pa.locator('.dm-list').textContent())?.includes('Suns'))
  await pa.screenshot({ path: '.impeccable/review/dm-request.png' })

  const [t] = await sql`select id, accepted_at, started_by from dm_threads where started_by = ${a.uid}`
  ok('the thread is pending', !!t && t.accepted_at === null, 'accepted already')

  console.log('\n— a second message is held back —')
  const disabled = await pa.locator('.room-form input').isDisabled()
  ok('the composer says wait', disabled, 'they could keep typing at a stranger')

  console.log('\n— it lands in Requests, not the inbox —')
  // leave the spot sheet first — its scrim covers the top bar, as it should
  await pb.goto(BASE + '#/', { waitUntil: 'networkidle' })
  await pb.waitForTimeout(2500)
  await pb.locator('.acct-btn[aria-label="Messages"]').click()
  await pb.waitForTimeout(2500)
  const chats = await pb.locator('.dm-thread').count()
  ok('Chats is empty', chats === 0, `${chats} threads in Chats`)
  await pb.locator('.pill', { hasText: 'Requests' }).click()
  await pb.waitForTimeout(800)
  ok('the request is waiting', await pb.locator('.dm-thread').count() === 1)
  await pb.screenshot({ path: '.impeccable/review/dm-requests.png' })

  console.log('\n— answering accepts —')
  await pb.locator('.dm-thread').first().click()
  await pb.waitForTimeout(1200)
  ok('the request explains itself', (await pb.locator('.dm-request-note').textContent())?.includes('ignore it'))
  await pb.locator('.room-form input').fill('yeah, the late show')
  await pb.locator('.room-send').click()
  await pb.waitForTimeout(2500)
  const [t2] = await sql`select accepted_at from dm_threads where id = ${t.id}`
  ok('the thread is accepted', !!t2.accepted_at, 'still pending')
  await pa.waitForTimeout(2500)
  ok('the reply reaches the sender live', (await pa.locator('.dm-list').textContent())?.includes('late show'))
  await pa.screenshot({ path: '.impeccable/review/dm-thread.png' })

  console.log('\n— blocking —')
  await pb.locator('.dm-act', { hasText: 'block' }).click()
  await pb.waitForTimeout(2000)
  const [blk] = await sql`select 1 from blocks where blocker_id = ${b.uid} and blocked_id = ${a.uid}`
  ok('the block is recorded', !!blk, 'no block row')
  await pa.locator('.room-form input').fill('are you there')
  await pa.locator('.room-send').click()
  await pa.waitForTimeout(2000)
  ok('the blocked sender cannot send', !(await pa.locator('.dm-list').textContent())?.includes('are you there'))
} finally {
  const uids = [a.uid, b.uid, undeclared.uid]
  await sql`delete from dm_threads where lo = any(${uids}) or hi = any(${uids})`
  await sql`delete from blocks where blocker_id = any(${uids})`
  await sql`delete from room_messages where author_id = any(${uids})`
  await sql`delete from auth.users where email = any(${[a.email, b.email, undeclared.email]})`
  await sql.end()
  await browser.close()
}

console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
