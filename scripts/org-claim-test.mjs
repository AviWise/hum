// End-to-end on the claim flow: a signed-in person sees the invitation on
// their own profile, fills the form, and the row that lands is unreviewed and
// owned by them. Then the same account tries a second claim and is told no.
//
// node scripts/org-claim-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4180/out-dc/'
const URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
const KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'
const REF = 'hxmjszgvkynrwscelnzx'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

const fail = []
const ok = (cond, line) => { console.log(`${cond ? '  ok ' : ' FAIL'}  ${line}`); if (!cond) fail.push(line) }

const email = 'outdc.claim.ui@example.com'
const password = 'claim-ui-test-99'
const c = createClient(URL, KEY, { auth: { persistSession: false } })
await c.auth.signUp({ email, password, options: { data: { username: 'claim.ui' } } })
const { data: signed, error: sErr } = await c.auth.signInWithPassword({ email, password })
if (sErr) { console.log('could not sign in:', sErr.message); process.exit(1) }
const uid = signed.user.id
await sql`delete from org_claims where user_id = ${uid}`

const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
// hand the app a real session rather than driving the sign-in sheet
await page.addInitScript(([key, session]) => {
  localStorage.setItem(key, JSON.stringify(session))
}, [`sb-${REF}-auth-token`, signed.session])

await page.goto(BASE + '#/me', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

console.log('— the invitation is on your own profile —')
ok(await page.locator('.org-claim-cta').count() === 1, 'the "Run a student org?" row is there')
await page.screenshot({ path: '.impeccable/review/org-claim-cta.png' })

console.log('\n— filling it in —')
await page.locator('.org-claim-cta').click()
await page.waitForTimeout(500)
ok(await page.locator('#org-name').count() === 1, 'the claim sheet opened')
await page.screenshot({ path: '.impeccable/review/org-claim-sheet.png' })
await page.locator('#org-name').fill('Night Owls Film Society')
await page.locator('#org-school').selectOption('gwu.edu')
await page.locator('#org-evidence').fill('I am the president; our page is on the GW student org directory')
await page.locator('button[type="submit"]').click()
await page.waitForTimeout(1800)
ok((await page.locator('.sheet-name').textContent())?.includes('Filed'), 'it confirms the claim was filed')
await page.screenshot({ path: '.impeccable/review/org-claim-filed.png' })

console.log('\n— what actually landed in the database —')
const rows = await sql`select org_name, school_domain, evidence, reviewed_at, approved, user_id from org_claims where user_id = ${uid}`
ok(rows.length === 1, `exactly one claim row (${rows.length})`)
if (rows.length) {
  const r = rows[0]
  ok(r.org_name === 'Night Owls Film Society', `org name stored (${r.org_name})`)
  ok(r.school_domain === 'gwu.edu', `school stored (${r.school_domain})`)
  ok(r.reviewed_at === null && r.approved === null, 'unreviewed, unapproved')
  ok(r.user_id === uid, 'owned by the account that filed it')
}

console.log('\n— the claim did NOT make them an org —')
const [prof] = await sql`select kind, school_domain from profiles where id = ${uid}`
ok(prof.kind === 'person', `still a person (${prof.kind})`)
ok(prof.school_domain === null, 'no school stamped on the profile')

console.log('\n— a second claim is refused —')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.locator('.org-claim-cta').click()
await page.waitForTimeout(400)
await page.locator('#org-name').fill('Another Group')
await page.locator('button[type="submit"]').click()
await page.waitForTimeout(1500)
const err = await page.locator('.form-err').textContent().catch(() => null)
ok(!!err && /already/.test(err), `told plainly why (${err || 'no message shown'})`)
const after = await sql`select id from org_claims where user_id = ${uid}`
ok(after.length === 1, `still only one claim row (${after.length})`)

await sql`delete from org_claims where user_id = ${uid}`
await sql`delete from auth.users where email = ${email}`
await sql.end()
await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
