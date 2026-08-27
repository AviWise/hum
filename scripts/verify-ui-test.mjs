// The verification sheet, driven as a student would: open it from your own
// profile, accept the prefilled school address, land verified.
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4181/hum/'
const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const REF = 'hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })
const fail = []
const ok = (c, l) => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}`); if (!c) fail.push(l) }

const email = 'hum.verify.ui@gwu.edu'
const c = createClient(URL, KEY, { auth: { persistSession: false } })
await c.auth.signUp({ email, password: 'verify-ui-99', options: { data: { username: 'verify.ui' } } })
const { data: signed } = await c.auth.signInWithPassword({ email, password: 'verify-ui-99' })
await sql`update auth.users set email_confirmed_at = now() where id = ${signed.user.id}`
await sql`delete from school_verifications where user_id = ${signed.user.id}`

const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [`sb-${REF}-auth-token`, signed.session])
await page.goto(BASE + '#/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

console.log('— the invitation is on your own profile —')
ok(await page.locator('.org-claim-cta', { hasText: 'Go to school here?' }).count() === 1, 'the "Go to school here?" row is there')
await page.locator('.org-claim-cta', { hasText: 'Go to school here?' }).click()
await page.waitForTimeout(1500)

// this account signed up with a gwu.edu address, so the picker should have
// answered its own question and moved on
console.log('\n— it recognises the school you signed up with —')
ok((await page.locator('.sheet-name').textContent())?.includes('George Washington'), 'skipped straight to GW')
ok(await page.locator('#ver-email').inputValue() === email, 'and prefilled the address')
await page.screenshot({ path: '.impeccable/review/verify-address.png' })

console.log('\n— you can go back and choose another —')
await page.locator('.verify-back').click()
await page.waitForTimeout(700)
const picker = await page.evaluate(() => ({
  heading: document.querySelector('.sheet-name')?.textContent,
  rows: [...document.querySelectorAll('.school-row')].map((r) => r.textContent),
  marks: document.querySelectorAll('.school-mark').length,
  imgs: document.querySelectorAll('.school-list img, .school-list svg').length,
}))
ok(picker.heading === 'Where do you go?', `picker heading (${picker.heading})`)
ok(picker.rows.length === 11, `${picker.rows.length} schools listed`)
ok(picker.rows.some((r) => r.includes('American') && r.includes('american.edu')), 'American is there with its domain')
ok(!picker.rows.some((r) => r.includes('Sample University')), 'the demo school is hidden from students')
ok(picker.marks === 11, `${picker.marks} colour marks`)
ok(picker.imgs === 0, 'no logos or seals — colour and name only')
await page.screenshot({ path: '.impeccable/review/verify-picker.png' })

console.log('\n— picking the wrong school for your address is refused clearly —')
await page.locator('.school-row', { hasText: 'American' }).click()
await page.waitForTimeout(600)
ok((await page.locator('#ver-email').inputValue()) === '', 'a mismatched address is not carried over')
await page.locator('#ver-email').fill(email)
await page.locator('button[type="submit"]').click()
await page.waitForTimeout(2500)
const mismatch = await page.locator('.form-err').textContent().catch(() => null)
ok(!!mismatch && mismatch.includes('american.edu'), `it names the school you chose (${mismatch})`)
await page.screenshot({ path: '.impeccable/review/verify-mismatch.png' })

console.log('\n— choosing the right one verifies —')
await page.locator('.verify-back').click()
await page.waitForTimeout(700)
await page.locator('.school-row', { hasText: 'George Washington' }).click()
await page.waitForTimeout(600)
await page.locator('#ver-email').fill(email)
await page.locator('button[type="submit"]').click()
await page.waitForTimeout(3000)
const heading = await page.locator('.sheet-name').textContent()
ok(heading?.includes('You’re in'), `it verified without a code (${heading})`)
await page.screenshot({ path: '.impeccable/review/verify-done.png' })

const [row] = await sql`select domain, email_hash from school_verifications where user_id = ${signed.user.id}`
ok(row?.domain === 'gwu.edu', `recorded at gwu.edu (${row?.domain})`)
ok(row?.email_hash && !row.email_hash.includes('@'), 'the address is hashed, not stored')

await page.locator('.btn-primary').click()
await page.waitForTimeout(1200)
ok(await page.locator('.verified-line').count() === 1, 'the profile now shows the verified line')
await page.screenshot({ path: '.impeccable/review/verify-profile.png' })

await sql`delete from auth.users where email = ${email}`
await sql.end()
await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
