// A shared spot link has to do two jobs: give a crawler this spot's own card,
// and put a person on the map. node scripts/share-page-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
import { readFileSync, readdirSync } from 'node:fs'
const BASE = process.argv[2] || 'http://localhost:4185/out-dc/'
const fail = []
const ok = (l, c, d = '') => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}${c ? '' : '  <-- ' + d}`); if (!c) fail.push(l) }

const dirs = readdirSync('dist/s')
console.log('— every spot got a page —')
ok(`${dirs.length} share pages built`, dirs.length === 116, `${dirs.length}`)
let generic = 0, noTitle = 0, badImg = 0
for (const d of dirs) {
  const h = readFileSync(`dist/s/${d}/index.html`, 'utf8')
  const t = h.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || ''
  const img = h.match(/<meta property="og:image" content="([^"]*)"/)?.[1] || ''
  if (!t || t === 'out.') noTitle++
  if (t.includes("where's it worth going")) generic++
  if (!img.startsWith('https://')) badImg++
}
ok('none fell back to the generic site title', generic === 0, `${generic} generic`)
ok('every page has its own title', noTitle === 0, `${noTitle} missing`)
ok('every image is an absolute URL', badImg === 0, `${badImg} relative`)

console.log('\n— what a crawler reads —')
const h = readFileSync('dist/s/carnegie-library/index.html', 'utf8')
ok('title names the spot', /og:title" content="Carnegie Library/.test(h))
ok('description is the spot’s own line', /og:description" content="[^"]{20,}/.test(h))
ok('canonical points at itself', /rel="canonical" href="[^"]*\/s\/carnegie-library\//.test(h))
ok('card is the large format', /twitter:card" content="summary_large_image/.test(h))

console.log('\n— what a person gets —')
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
// headless Chrome HAS navigator.share, and its share sheet silently does
// nothing — which is indistinguishable from a broken button. Removing it
// forces the copy branch, and both branches are handed the same url value.
await ctx.addInitScript(() => { delete Navigator.prototype.share })
const p = await ctx.newPage()
await p.goto(BASE + 's/carnegie-library/', { waitUntil: 'networkidle' })
await p.waitForTimeout(3500)
ok('lands in the app', (await p.evaluate(() => location.hash)) === '#/spot/carnegie-library',
  await p.evaluate(() => location.href))
ok('with the spot open', (await p.locator('.sheet-name').textContent().catch(() => '') || '').includes('Carnegie'))

console.log('\n— and the share button hands out that URL —')
await p.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
// read what actually reached the clipboard rather than stubbing the API —
// shareOrCopy has three fallbacks and a stub only proves one of them
await p.locator('.spot-action', { hasText: 'Share' }).click()
await p.waitForTimeout(1200)
const url = await p.evaluate(() => navigator.clipboard.readText().catch(() => null))
ok('Share copies the /s/ link, not the hash route', !!url && url.includes('/s/adams-morgan/'), url || '(nothing copied)')
await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
