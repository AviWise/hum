// The spot sheet as a three-stop sheet: does it snap, does the map survive
// behind it, and is everything still reachable at the smallest stop.
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4187/hum/'
const fail = []
const ok = (l, c, d = '') => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}${c ? '' : '  <-- ' + d}`); if (!c) fail.push(l) }
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const h = () => p.evaluate(() => Math.round(document.querySelector('.sheet').getBoundingClientRect().height))
const drag = async (dy) => {
  const box = await p.locator('.sheet-drag').boundingBox()
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await p.mouse.move(x, y); await p.mouse.down()
  await p.mouse.move(x, y - dy, { steps: 10 })
  await p.mouse.up()
  await p.waitForTimeout(700)
}

await p.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)

console.log('— it opens at the middle stop —')
const half = await h()
ok(`opens around 70% of the screen (${half}px of 844)`, half > 520 && half < 640, `${half}`)

console.log('— the map is not blacked out behind it —')
const scrim = await p.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.sheet-scrim'))
  return { bg: s.backgroundColor, blur: s.backdropFilter }
})
ok('no dimming layer over the map', /rgba\(0, 0, 0, 0\)|transparent/.test(scrim.bg), scrim.bg)
ok('no blur over the map', scrim.blur === 'none', scrim.blur)
ok('the map is visible above the sheet', await p.locator('canvas').first().isVisible())
await p.screenshot({ path: '.impeccable/review/detent-half.png' })

console.log('\n— drag up, drag down —')
await drag(220)
const full = await h()
ok(`drags up to the full stop (${full}px)`, full > half + 60, `${half} -> ${full}`)
await p.screenshot({ path: '.impeccable/review/detent-full.png' })
await drag(-400)
const peek = await h()
ok(`drags down to the peek stop (${peek}px)`, peek < half - 60, `${full} -> ${peek}`)
ok('...and stops there rather than closing', await p.locator('.sheet').count() === 1)
await p.screenshot({ path: '.impeccable/review/detent-peek.png' })

console.log('\n— everything is still reachable at the smallest stop —')
ok('the sheet scrolls its own content', await p.evaluate(() => {
  const s = document.querySelector('.sheet')
  return s.scrollHeight > s.clientHeight + 20
}))
await p.evaluate(() => { const s = document.querySelector('.sheet'); s.scrollTop = s.scrollHeight })
await p.waitForTimeout(500)
ok('the room at the bottom can be scrolled to', await p.locator('.room-form input').isVisible())

console.log('\n— tapping the handle cycles, dragging it far down puts it away —')
await p.locator('.sheet-grab').click()
await p.waitForTimeout(600)
ok('a tap moves it up a stop', (await h()) > peek + 40, `${peek} -> ${await h()}`)
await drag(-800)
ok('a long drag down closes it', await p.locator('.sheet').count() === 0)

console.log('\n— desktop is untouched —')
await p.setViewportSize({ width: 1512, height: 950 })
await p.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
const desk = await p.evaluate(() => {
  const s = document.querySelector('.sheet')
  return { h: Math.round(s.getBoundingClientRect().height), scrim: getComputedStyle(document.querySelector('.sheet-scrim')).backgroundColor }
})
ok('the sheet keeps its own height on desktop', desk.h < 950 * 0.9, `${desk.h}`)
ok('and the scrim comes back', !/rgba\(0, 0, 0, 0\)$/.test(desk.scrim), desk.scrim)

await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
