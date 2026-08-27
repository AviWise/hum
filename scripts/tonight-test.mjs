// Tonight should answer "what's going on", not perform a front page.
// node scripts/tonight-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4191/hum/'
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const b = await chromium.launch({ channel:'chrome' })
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
await p.goto(BASE + '#/tonight', { waitUntil:'networkidle' })
await p.waitForTimeout(3000)

console.log('— it says what you are looking at —')
const orient = await p.locator('.tp-orient').textContent()
ok('there is an orientation line', !!orient, '(none)')
ok('it counts things rather than emoting', /\d/.test(orient), orient)
console.log(`   "${orient.trim()}"`)

console.log('\n— the regulars are folded, and labelled as regular —')
ok('the weekly stuff is behind a fold', await p.locator('.tp-fold').count() === 1)
const foldLabel = await p.locator('.tp-fold').textContent()
ok('the fold says what they are', /usually on a \w+day/.test(foldLabel), foldLabel)
ok('they are not in the main list', await p.locator('.tp-rows:not(.tp-rows-quiet) .tp-row').count() === 0
  || !(await p.locator('.tp-rows:not(.tp-rows-quiet)').textContent()).includes('every '))

// The fold starts OPEN when nothing one-off is on, because the regulars are
// then the only answer to "what's going on" — so drive it to a known state
// rather than assuming a direction.
const foldOpen = () => p.locator('.tp-rows-quiet').count().then((n) => n > 0)
if (!(await foldOpen())) { await p.locator('.tp-fold').click(); await p.waitForTimeout(600) }
ok('the regulars can be shown', await p.locator('.tp-rows-quiet .tp-row').count() > 0)
await p.locator('.tp-fold').click(); await p.waitForTimeout(600)
ok('...and folded away again', !(await foldOpen()))
await p.locator('.tp-fold').click(); await p.waitForTimeout(600)
ok('...each marked as recurring', (await p.locator('.tp-rows-quiet').textContent()).includes('every '))
await p.screenshot({ path:'.impeccable/review/tonight-new.png', fullPage:true })

console.log('\n— the recurrence labels are true —')
{
  const { SPOTS, CALENDAR, seedEvents } = await import('../src/data/spots.js')
  const evs = seedEvents(Date.now())
  const seeded = evs.filter((e) => e.id !== 'x1')
  const oneOffs = seeded.filter((e) => e.once)
  const weekly = seeded.filter((e) => !e.once && !e.everyday)
  console.log(`   ${oneOffs.length} one-off, ${weekly.length} weekly, ${seeded.length - oneOffs.length - weekly.length} most-days`)
  // every claim of "once" must be backed by a dated CALENDAR entry
  const datedIds = new Set(CALENDAR.filter((c) => c.date).map((c) => c.id))
  ok('every "tonight only" is genuinely dated', oneOffs.every((e) => datedIds.has(e.id)),
    oneOffs.filter((e) => !datedIds.has(e.id)).map((e) => e.id).join(','))
  // and nothing dated is being called weekly
  ok('nothing dated is labelled as recurring', weekly.every((e) => !datedIds.has(e.id)),
    weekly.filter((e) => datedIds.has(e.id)).map((e) => e.id).join(','))
  const shown = await p.locator('.tp-rows-quiet').textContent()
  ok('the fold never claims a cadence for a one-off',
    !oneOffs.some((e) => shown.includes(e.title)), 'a one-off is in the weekly fold')
}

console.log('\n— nothing pretends to be breaking news when nothing is —')
const heroes = await p.locator('.tp-hero').count()
const posted = await p.locator('.tp-rows:not(.tp-rows-quiet) .tp-row').count()
console.log(`   posts tonight: ${posted}, hero shown: ${heroes}`)
ok('no hero without something posted tonight', posted > 0 || heroes === 0, `${heroes} heroes with ${posted} posts`)
if (heroes) {
  const box = await p.locator('.tp-hero').boundingBox()
  ok('the hero leaves room for the list below it', box.height < 844 * 0.5, `${Math.round(box.height)}px of 844`)
}

console.log('\n— the empty state points somewhere —')
if (posted === 0) {
  const empty = await p.locator('.empty-line').first().textContent()
  ok('it offers what usually happens instead of a dead end', /usually on is below|first/.test(empty), empty)
}

console.log('\n— seen state survives a reload —')
await p.evaluate(() => localStorage.setItem('out.seenEvents', JSON.stringify({ 'u-probe': Date.now() })))
await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(2500)
ok('the store persists', await p.evaluate(() => !!localStorage.getItem('out.seenEvents')))

await b.close()
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
