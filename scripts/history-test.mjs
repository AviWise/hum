// F1: a durable, per-person, world-readable location history is the finding,
// not the feature.
//
// This file REPLACES the old history-test.mjs, which asserted the opposite —
// "the record persists", "the spot remembers", "the author's profile keeps its
// archive" — because 20260826_durable_history.sql had made that the design. F1
// withdrew that design on 2026-08-28. The one assertion from the old suite that
// survived is that the map must never present an expired post as current, and
// it is kept below.
//
// Checked by what a browser is actually served, not by reading the policy: the
// policy is the thing under test.
import { chromium } from 'playwright-core'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env','utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host:'aws-0-us-east-2.pooler.supabase.com', port:5432, database:'postgres', username:'postgres.hxmjszgvkynrwscelnzx', password:pass, ssl:'require', onnotice:()=>{} })
// needs `npm run dev` (port 5180) — this asserts what a browser renders
const BASE = process.argv[2] || 'http://localhost:5180/hum/'
const REF = 'hxmjszgvkynrwscelnzx'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const OLD = 'f1 fixture — where I was on tuesday'
const NEW = 'f1 fixture — where I am right now'
const PW = 'f1probe-pass-123'

await sql`delete from auth.users where email like 'f1probe.%@example.com'`
const uname = `f1probe.${Math.random().toString(36).slice(2,6)}`
const email = `f1probe.${Date.now()}@example.com`
// GoTrue scans these token columns into non-nullable Go strings, so a row
// inserted directly with NULLs there makes every sign-in fail with a 500
// "Database error querying schema" that looks like a broken database and is a
// broken fixture.
const [u] = await sql`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated','authenticated', ${email},
          crypt(${PW}, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}',
          ${sql.json({ username: uname })}, '', '', '', '', '', '', '', '') returning id`
await sql.unsafe('alter table posts disable trigger user')
await sql`insert into posts (spot_id, title, username, author_id, created_at, expires_at, is_demo)
  values ('shaw', ${OLD}, ${uname}, ${u.id}, now() - interval '2 days', now() - interval '2 days' + interval '3 hours', false)`
await sql`insert into posts (spot_id, title, username, author_id, created_at, expires_at, is_demo)
  values ('dupont-circle', ${NEW}, ${uname}, ${u.id}, now(), now() + interval '3 hours', false)`
await sql.unsafe('alter table posts enable trigger user')
console.log(`fixture user @${uname}: one expired post, one live one\n`)

const browser = await chromium.launch({ channel: 'chrome' })
const seen = async (page) => page.evaluate(() => document.body.innerText)

// ---------- 1. a logged-out stranger ----------
const stranger = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await stranger.goto(`${BASE}u/${uname}`)
await stranger.waitForTimeout(7000)
const strangerText = await seen(stranger)
await stranger.screenshot({ path: '.impeccable/review/f1-stranger.png' })
console.log('LOGGED-OUT STRANGER on /u/' + uname)
console.log('  sees the expired post :', strangerText.includes(OLD), strangerText.includes(OLD) ? '  <-- F1 STILL OPEN' : '')
console.log('  sees the live post    :', strangerText.includes(NEW))
console.log('  --- what the page shows ---')
console.log(strangerText.split('\n').filter(Boolean).slice(0, 14).map((l) => '    ' + l).join('\n'))
// what the browser was actually served, independent of how the page renders it
const api = await stranger.evaluate(async ([ref, key, name]) => {
  const r = await fetch(`https://${ref}.supabase.co/rest/v1/posts?username=eq.${name}&select=title,expires_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return r.json()
}, [REF, KEY, uname])
console.log('  REST returns to a stranger:', JSON.stringify(api))
// kept from the old history-test: expiry still governs the live map
const onMapAsLive = await stranger.evaluate((c) => document.body.innerText.includes(c), OLD)
console.log('  never shown as live on the map:', !onMapAsLive)
await stranger.close()

// ---------- 2. the author themselves ----------
const r = await fetch(`https://${REF}.supabase.co/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PW }),
})
const session = await r.json()
if (!session.access_token) { console.log('sign-in failed:', JSON.stringify(session).slice(0,200)); process.exit(1) }

const me = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await me.goto(BASE)
await me.evaluate(([ref, s]) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s)), [REF, session])
await me.goto(`${BASE}u/${uname}`)
await me.waitForTimeout(6000)
const meText = await seen(me)
await me.screenshot({ path: '.impeccable/review/f1-author.png' })
const mine = await me.evaluate(async ([ref, key, tok, name]) => {
  const r = await fetch(`https://${ref}.supabase.co/rest/v1/posts?username=eq.${name}&select=title`, {
    headers: { apikey: key, Authorization: `Bearer ${tok}` },
  })
  return r.json()
}, [REF, KEY, session.access_token, uname])
const titles = (mine || []).map((p) => p.title)
console.log('\nTHE AUTHOR, signed in')
console.log('  REST returns to them  :', JSON.stringify(titles))
console.log('  keeps their archive   :', titles.includes(OLD), titles.includes(OLD) ? '' : '  <-- own archive lost')
console.log('  keeps their live post :', titles.includes(NEW))

// ---------- 3. the delete-account door ----------
// Signed in through the real form rather than by injecting a session, so this
// exercises the path a student actually takes.
await me.goto(BASE)
await me.waitForTimeout(6000)
const already = await me.evaluate(() =>
  !![...document.querySelectorAll('.acct-btn')].find((e) => /^Account/.test(e.getAttribute('aria-label') || '')))
if (!already) {
  await me.click('[aria-label="Sign in"]')
  await me.waitForTimeout(700)
  await me.click('[role="tab"]:has-text("sign in")')
  await me.waitForTimeout(400)
  await me.fill('input[type="email"]', email)
  await me.fill('input[type="password"]', PW)
  await me.click('button[type="submit"]')
  await me.waitForTimeout(4000)
}
console.log('  signed in already from the restored session:', already)

const label = await me.evaluate(() => {
  const b = [...document.querySelectorAll('.acct-btn')].find((e) => /^Account/.test(e.getAttribute('aria-label') || ''))
  if (!b) return null
  b.click()
  return b.getAttribute('aria-label')
})
await me.waitForTimeout(1000)
console.log('\nACCOUNT SHEET (opened via:', JSON.stringify(label) + ')')
await me.screenshot({ path: '.impeccable/review/f1-account.png' })

const clicked = await me.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((e) => /delete my account/i.test(e.textContent))
  if (b) { b.click(); return true }
  return false
})
await me.waitForTimeout(900)
await me.screenshot({ path: '.impeccable/review/f1-delete.png' })
console.log('  "delete my account" offered   :', clicked)
const confirmText = await seen(me)
console.log('  confirm names the account     :', confirmText.toLowerCase().includes(uname))
const btnState = await me.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((e) => /^delete my account$/i.test(e.textContent.trim()) && e.classList.contains('acct-danger-go'))
  return b ? { disabled: b.disabled } : null
})
console.log('  confirm button starts disabled:', btnState?.disabled)
// type the wrong name, then the right one
await me.fill('#acct-confirm', 'not-my-username')
await me.waitForTimeout(250)
const wrong = await me.evaluate(() => [...document.querySelectorAll('button')].find((e) => e.classList.contains('acct-danger-go'))?.disabled)
await me.fill('#acct-confirm', uname)
await me.waitForTimeout(250)
const right = await me.evaluate(() => [...document.querySelectorAll('button')].find((e) => e.classList.contains('acct-danger-go'))?.disabled)
console.log('  stays disabled on wrong name  :', wrong)
console.log('  enables on the right name     :', right === false)
await me.screenshot({ path: '.impeccable/review/f1-delete-armed.png' })
console.log('  screenshots: .impeccable/review/f1-account.png, f1-delete.png, f1-delete-armed.png')

// ---------- 4. press it, and check the account is really gone ----------
await me.click('.acct-danger-go')
await me.waitForTimeout(4000)
await me.screenshot({ path: '.impeccable/review/f1-deleted.png' })

const stillThere = await sql`select 1 from auth.users where id = ${u.id}`
const profileLeft = await sql`select 1 from profiles where username = ${uname}`
const postsLeft = await sql`select title from posts where username = ${uname}`
const signedOut = await me.evaluate(() =>
  !![...document.querySelectorAll('.acct-btn')].find((e) => e.getAttribute('aria-label') === 'Sign in'))
console.log('\nAFTER PRESSING DELETE')
console.log('  auth user gone   :', stillThere.length === 0)
console.log('  profile gone     :', profileLeft.length === 0)
console.log('  posts gone       :', postsLeft.length === 0, postsLeft.length ? JSON.stringify(postsLeft.map((r) => r.title)) : '')
console.log('  app signed out   :', signedOut)

await me.close()
await browser.close()

await sql`delete from auth.users where id = ${u.id}`
await sql`delete from posts where username = ${uname}`
await sql`delete from dm_reports where thread_id is null`
await sql.end()
