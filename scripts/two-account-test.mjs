// The posting loop, proven between two real accounts in two browsers.
// node scripts/two-account-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import postgres from 'postgres'
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BASE = process.argv[2] || 'http://localhost:5180/out-dc/'
const pass = readFileSync('.env', 'utf8').match(/SUPABASE_DB_PASSWORD=(\S+)/)[1]
const sql = postgres({ host: 'aws-0-us-east-2.pooler.supabase.com', port: 5432, database: 'postgres', username: 'postgres.hxmjszgvkynrwscelnzx', password: pass, ssl: 'require', onnotice: () => {} })

// a photo carrying GPS EXIF, so the strip can be proven rather than assumed
const FIXTURE = '/tmp/out-exif-fixture.jpg'
await sharp({ create: { width: 1400, height: 1000, channels: 3, background: { r: 190, g: 120, b: 70 } } })
  .withExif({ IFD0: { Copyright: 'out-test' }, GPS: { GPSLatitudeRef: 'N', GPSLatitude: '38/1 54/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '77/1 2/1 0/1' } })
  .jpeg().toFile(FIXTURE)
const beforeExif = await sharp(FIXTURE).metadata()
console.log('fixture has EXIF block:', !!beforeExif.exif, '| bytes:', beforeExif.size)

const browser = await chromium.launch({ channel: 'chrome' })
const signIn = async (page, tag) => {
  const email = `outdc.loop.${tag}@example.com`
  const pw = `loop-test-${tag}-42`
  await page.goto(BASE)
  await page.waitForTimeout(7000)
  await page.click('.acct-btn[aria-label="Sign in"], .acct-btn.acct-in')
  await page.waitForTimeout(700)
  if (await page.$('#acct-fname')) {
    await page.fill('#acct-fname', `Loop ${tag}`)
    await page.fill('#acct-uname', `loop.${tag}`)
    await page.fill('#acct-email', email)
    await page.fill('#acct-pass', pw)
  } else {
    await page.click('.acct-tabs .pill:nth-child(2)')
    await page.fill('#acct-email', email)
    await page.fill('#acct-pass', pw)
  }
  await page.click('.sheet form .post-submit')
  // GoTrue can cold-start on the first signup of a session; wait it out rather
  // than failing a test on infrastructure warm-up
  await page.waitForFunction(() => !document.querySelector('.sheet-post-form'), { timeout: 90000 })
  await page.waitForTimeout(1200)
  return email
}

const ctxA = await browser.newContext({ viewport: { width: 390, height: 800 } })
const ctxB = await browser.newContext({ viewport: { width: 390, height: 800 } })
const A = await ctxA.newPage()
const B = await ctxB.newPage()
const emailA = await signIn(A, 'a')
const emailB = await signIn(B, 'b')
console.log('two accounts signed in')

// A posts, with a photo, expiring in 1 hour
const CAPTION = 'loop test — two account proof'
await A.click('.tab-post')
await A.waitForTimeout(800)
await A.selectOption('#post-spot', 'shaw')
await A.fill('#post-text', CAPTION)
await A.setInputFiles('input[type=file]', FIXTURE)
await A.waitForTimeout(900)
await A.click('.dur-row .pill:nth-child(1)') // 1 hour
await A.click('.post-submit')
await A.waitForTimeout(4000)
const springed = await A.evaluate(() => !!document.querySelector('.gmark-drop')) ||
  await A.evaluate(() => !!document.querySelector('.drop-chip'))
console.log('A posted — pin-drop fired:', springed)

const [row] = await sql`select id, author_id, spot_id, title, photo_path, mid_path, thumb_path, expires_at, is_demo, removed_at from posts where title = ${CAPTION}`
console.log('stored row:', {
  spot: row.spot_id, is_demo: row.is_demo, removed: row.removed_at,
  sizes: ['photo_path', 'mid_path', 'thumb_path'].filter((k) => row[k]).length,
})

// the three stored sizes are real, and the biggest one carries no GPS
const sizes = {}
for (const k of ['thumb_path', 'mid_path', 'photo_path']) {
  const buf = Buffer.from(await (await fetch(row[k])).arrayBuffer())
  const meta = await sharp(buf).metadata()
  sizes[k] = { w: meta.width, h: meta.height, kb: Math.round(buf.length / 1024), exif: !!meta.exif }
}
console.log('stored sizes:', JSON.stringify(sizes))

// B sees it after a refresh
await B.reload()
await B.waitForTimeout(8000)
await B.click('.tab-item:has-text("Feed")')
await B.waitForTimeout(2600)
const seenByB = await B.evaluate((c) => [...document.querySelectorAll('.mas-title, .mas-text p')].some((e) => e.textContent.includes(c)), CAPTION)
console.log("B sees A's post in the feed:", seenByB)

// and in the spot sheet's Happening here
await B.goto(`${BASE}?spot=shaw`)
await B.waitForTimeout(8000)
const inSheet = await B.evaluate((c) => [...document.querySelectorAll('.sheet-ev-title, .rec-title')].some((e) => e.textContent.includes(c)), CAPTION)
console.log("B sees it in Shaw's Happening here:", inSheet)

// impressions logged from real views
await B.waitForTimeout(2500)
const [imp] = await sql`select count(*)::int n from impressions where post_id = ${row.id}`
console.log('impressions logged for that post:', imp.n)

// expiry: the post falls out of every surface, by policy not by cleanup job
await sql`update posts set created_at = now() - interval '3 hours', expires_at = now() - interval '1 minute' where id = ${row.id}`
await B.reload()
await B.waitForTimeout(8000)
await B.click('.tab-item:has-text("Feed")')
await B.waitForTimeout(2600)
const goneFeed = !(await B.evaluate((c) => [...document.querySelectorAll('.mas-title, .mas-text p')].some((e) => e.textContent.includes(c)), CAPTION))
console.log('after expiry, gone from B feed:', goneFeed)

// "Nothing posted yet tonight" returns when a spot is empty
await B.goto(`${BASE}?spot=shaw`)
await B.waitForTimeout(8000)
const emptyLine = await B.evaluate(() => document.body.textContent.includes('Nothing posted yet tonight'))
console.log('empty-state copy returns:', emptyLine)

await sql`delete from posts where title = ${CAPTION}`
await sql`delete from auth.users where email in (${emailA}, ${emailB})`
await sql.end()
await browser.close()
