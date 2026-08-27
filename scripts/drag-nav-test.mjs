// Does the nav capsule behave like a thing you can grab?
//
// Checks: it tracks the pointer mid-drag, it commits the tab you release on,
// it stretches instead of escaping past either end, a plain tap still routes,
// and a released drag does not also fire the click underneath it.
import { chromium } from 'playwright-core'

const BASE = process.argv[2] || 'http://localhost:4173/hum/'
const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const fail = []
const ok = (cond, line) => { console.log(`${cond ? '  ok ' : ' FAIL'}  ${line}`); if (!cond) fail.push(line) }

const cap = () => page.evaluate(() => {
  const c = document.querySelector('.tab-cap')
  const p = document.querySelector('.tabbar-pill')
  if (!c || !p) return null
  const r = c.getBoundingClientRect(), pr = p.getBoundingClientRect()
  return {
    center: r.left + r.width / 2 - pr.left, width: r.width,
    lit: document.querySelector('.tab-item.tab-lit .tab-label')?.textContent || null,
    dragging: c.classList.contains('tab-cap-drag'),
  }
})
const centerOf = (id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-tab="${i}"]`)
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, id)

await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForSelector('.tab-cap')
await page.waitForTimeout(400)

console.log('— capsule starts on the route —')
let c = await cap()
const mapC = await centerOf('map')
ok(c.lit === 'Map', `lit tab is Map (${c.lit})`)
ok(c.width > 60, `capsule has width ${Math.round(c.width)}px`)

// You opens the account sheet when signed out, so the drag tests stay on the
// three tabs that just route.
const feedC = await centerOf('feed')
const tonightC = await centerOf('tonight')
const pillLeft = () => page.evaluate(() => document.querySelector('.tabbar-pill').getBoundingClientRect().left)

console.log('\n— drag Map -> Feed, tracking the pointer —')
await page.mouse.move(mapC.x, mapC.y)
await page.mouse.down()
await page.mouse.move(mapC.x + 30, mapC.y, { steps: 4 })
const mid = await cap()
ok(mid.dragging, 'capsule is in drag mode (transition off)')
ok(Math.abs(mid.center - (mapC.x + 30 - (await pillLeft()))) < 2,
  `capsule centre sits under the pointer (${Math.round(mid.center)})`)
await page.mouse.move(feedC.x, feedC.y, { steps: 8 })
const overFeed = await cap()
ok(overFeed.lit === 'Feed', `tab under the thumb previews as lit (${overFeed.lit})`)
ok(await page.evaluate(() => location.hash) === '#/', 'route has NOT changed yet (commits on release)')

console.log('\n— release commits —')
await page.mouse.up()
await page.waitForTimeout(450)
ok(await page.evaluate(() => location.hash) === '#/feed', `release routed to feed (${await page.evaluate(() => location.hash)})`)
const settled = await cap()
ok(!settled.dragging, 'transition restored after release')
ok(Math.abs(settled.center - (feedC.x - (await pillLeft()))) < 3, 'capsule settled centred on Feed')

console.log('\n— past the end it stretches, it does not escape —')
await page.mouse.move(feedC.x, feedC.y)
await page.mouse.down()
await page.mouse.move(mapC.x, mapC.y, { steps: 8 })
const overMap = await cap()
await page.mouse.move(mapC.x - 70, mapC.y, { steps: 6 })
const pulled = await cap()
ok(pulled.center > mapC.x - (await pillLeft()) - 20, `capsule stayed inside the pill (centre ${Math.round(pulled.center)})`)
ok(pulled.width > overMap.width + 4, `capsule stretched ${Math.round(pulled.width - overMap.width)}px toward the thumb`)
await page.mouse.move(tonightC.x, tonightC.y, { steps: 6 })
await page.mouse.up()
await page.waitForTimeout(450)
ok(await page.evaluate(() => location.hash) === '#/tonight', `released on Tonight (${await page.evaluate(() => location.hash)})`)
ok(Math.abs((await cap()).width - c.width) < 3, `capsule un-stretched (${Math.round((await cap()).width)}px)`)

console.log('\n— a plain tap still routes —')
await page.mouse.click(feedC.x, feedC.y)
await page.waitForTimeout(400)
ok(await page.evaluate(() => location.hash) === '#/feed', `tap on Feed routed (${await page.evaluate(() => location.hash)})`)

console.log('\n— a drag that returns to where it started commits nothing extra —')
await page.mouse.move(feedC.x, feedC.y)
await page.mouse.down()
await page.mouse.move(tonightC.x, tonightC.y, { steps: 6 })
await page.mouse.move(feedC.x, feedC.y, { steps: 6 })
await page.mouse.up()
await page.waitForTimeout(400)
ok(await page.evaluate(() => location.hash) === '#/feed', 'still on feed, no stray navigation from the click underneath')

console.log('\n— desktop rail is untouched —')
await page.setViewportSize({ width: 1512, height: 900 })
await page.waitForTimeout(300)
const rail = await page.evaluate(() => ({
  capShown: getComputedStyle(document.querySelector('.tab-cap')).display !== 'none',
  order: [...document.querySelectorAll('.tabbar .tab-item')]
    .map((el) => ({ t: el.querySelector('.tab-label').textContent, o: +getComputedStyle(el).order || 0 }))
    .sort((a, b) => a.o - b.o).map((x) => x.t).join(' / '),
  onBg: getComputedStyle(document.querySelector('.tab-item.tab-on')).backgroundColor,
}))
ok(!rail.capShown, 'capsule is not rendered on the rail')
ok(rail.order === 'Map / Tonight / Feed / Search / Messages / You', `rail order ${rail.order}`)
ok(rail.onBg !== 'rgba(0, 0, 0, 0)', `active rail item keeps its fill (${rail.onBg})`)

await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
