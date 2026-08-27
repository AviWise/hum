import { chromium } from 'playwright-core'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })
const B = 'http://localhost:5180/hum/'
const browser = await chromium.launch({ channel: 'chrome' })
const p = await browser.newPage({ viewport: { width: 390, height: 800 } })
const email = 'hum.rep@example.com'
await p.goto(B); await p.waitForTimeout(7000)
await p.click('.acct-btn[aria-label="Sign in"], .acct-btn.acct-in'); await p.waitForTimeout(700)
if (await p.$('#acct-fname')) {
  await p.fill('#acct-fname', 'Rep Tester'); await p.fill('#acct-uname', 'rep.tester')
  await p.fill('#acct-email', email); await p.fill('#acct-pass', 'rep-test-31')
} else { await p.click('.acct-tabs .pill:nth-child(2)'); await p.fill('#acct-email', email); await p.fill('#acct-pass', 'rep-test-31') }
await p.click('.sheet form .post-submit')
await p.waitForFunction(() => !document.querySelector('.sheet-post-form'), { timeout: 90000 })
await p.waitForTimeout(1200)
const CAP = 'report path fixture post'
await p.click('.tab-post'); await p.waitForTimeout(800)
await p.selectOption('#post-spot', 'shaw'); await p.fill('#post-text', CAP)
await p.click('.post-submit'); await p.waitForTimeout(3500)
const [row] = await sql`select id from posts where title = ${CAP}`
await p.goto(`${B}?spot=shaw`); await p.waitForTimeout(8000)
const before = await p.evaluate((c) => document.body.textContent.includes(c), CAP)
await p.$eval('.rec-report', (el) => el.scrollIntoView({ block: 'center' }))
await p.click('.rec-report'); await p.waitForTimeout(400)
await p.click('.rec-report'); await p.waitForTimeout(1500)
const afterReport = await p.evaluate(() => !!document.querySelector('.rec-card'))
const [rep] = await sql`select count(*)::int n from reports where post_id = ${row.id}`
await p.reload(); await p.waitForTimeout(8000)
const stillHidden = !(await p.evaluate(() => !!document.querySelector('.rec-card')))
console.log('post visible before report:', before)
console.log('reports row written:', rep.n)
console.log('gone for reporter immediately:', !afterReport)
console.log('still gone after refresh:', stillHidden)
// global removal via the mod console path
await sql`update posts set removed_at = now(), hidden = true where id = ${row.id}`
const other = await browser.newPage({ viewport: { width: 390, height: 800 } })
await other.goto(`${B}?spot=shaw`); await other.waitForTimeout(8000)
console.log('gone globally for everyone else:', !(await other.evaluate((c) => document.body.textContent.includes(c), CAP)))
await sql`delete from posts where title = ${CAP}`
await sql`delete from auth.users where email = ${email}`
await sql.end(); await browser.close()
