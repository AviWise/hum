import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4182/hum/'
const b = await chromium.launch({ channel: 'chrome' })
const fail = []
const ok = (c, l) => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}`); if (!c) fail.push(l) }

const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto(BASE + '#/o/nightowls', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const d = await page.evaluate(() => ({
  name: document.querySelector('.prof-name')?.textContent,
  handle: document.querySelector('.prof-user')?.textContent,
  school: document.querySelector('.prof-school')?.textContent,
  stats: [...document.querySelectorAll('.prof-stat')].map((e) => e.textContent).join(' '),
  badges: document.querySelectorAll('.prof-badges li').length,
  story: document.querySelectorAll('.prof-ava-story').length,
  pins: document.querySelectorAll('.haunt-pin').length,
  tiles: document.querySelectorAll('.prof-tile').length,
  share: !!document.querySelector('.prof-share'),
}))
console.log('— the group page —')
ok(d.name === 'Night Owls Film Society', `name (${d.name})`)
ok(d.handle?.includes('@nightowls'), `handle (${d.handle})`)
ok(d.handle?.includes('Student org'), 'tagged as a student org')
ok(d.school === 'demo.edu', `school (${d.school})`)
ok(/events/.test(d.stats) && /spots/.test(d.stats), `stats (${d.stats})`)
ok(d.badges === 0, `no badges (${d.badges})`)
ok(d.story === 0, 'no story ring — a group is not a someone')
ok(d.pins > 0, `haunts map drew ${d.pins} pins`)
ok(d.tiles === 5, `${d.tiles} posts`)
ok(d.share, 'shareable')
await page.screenshot({ path: '.impeccable/review/org-page-390.png', fullPage: true })

console.log('\n— the old person route no longer pretends to be a group —')
await page.goto(BASE + '#/u/out.demo.nightowls', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const p = await page.evaluate(() => ({
  orgTag: !!document.querySelector('.org-tag'),
  tiles: document.querySelectorAll('.prof-tile').length,
}))
ok(!p.orgTag, 'no student-org tag on the person route')
ok(p.tiles === 0, `the group's posts are not on it (${p.tiles})`)

console.log('\n— a missing group says so —')
await page.goto(BASE + '#/o/doesnotexist', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
ok((await page.locator('.empty-line').textContent()) === 'No group here by that name.', 'clear empty state')

console.log('\n— desktop —')
const wide = await b.newPage({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 2 })
await wide.goto(BASE + '#/o/nightowls', { waitUntil: 'networkidle' })
await wide.waitForTimeout(2500)
ok(await wide.locator('.prof-name').count() === 1, 'renders at 1512 too')
await wide.screenshot({ path: '.impeccable/review/org-page-1512.png' })

await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
