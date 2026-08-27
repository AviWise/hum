// Press and drag to zoom, with no double-tap first — and a map you can pull
// back from. node scripts/press-zoom-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4194/out-dc/'
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const b = await chromium.launch({ channel:'chrome' })
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
await p.goto(BASE + '#/', { waitUntil:'networkidle' })
await p.waitForTimeout(4500)
await p.evaluate(() => { document.querySelector('.sheet-close')?.click(); document.querySelector('.opener-close')?.click() })
await p.waitForTimeout(600)

const z = () => p.evaluate(() => window.__map.getZoom())
const centre = () => p.evaluate(() => { const c = window.__map.getCenter(); return { lng: +c.lng.toFixed(4), lat: +c.lat.toFixed(4) } })
// An empty patch of canvas, found FRESH each time: markers move whenever the
// view changes, and a point that was bare canvas a moment ago can be sitting
// under a marker by the time the gesture runs — at which point the handler
// correctly bails and the test blames the handler.
const emptyPoint = () => p.evaluate(() => {
  for (let y = 300; y < 560; y += 15) for (let x = 60; x < 330; x += 15) {
    const el = document.elementFromPoint(x, y)
    if (el?.tagName === 'CANVAS') return { x, y }
  }
  return null
})
const pressDrag = async (dy, hold = 320) => {
  const spot = await emptyPoint()
  if (!spot) throw new Error('no bare canvas to press on')
  await p.mouse.move(spot.x, spot.y); await p.mouse.down()
  await p.waitForTimeout(hold)
  const engaged = await p.evaluate(() => document.querySelector('.map-gl').classList.contains('map-zooming'))
  for (let i = 1; i <= 12; i++) { await p.mouse.move(spot.x, spot.y + (dy/12)*i); await p.waitForTimeout(16) }
  await p.mouse.up(); await p.waitForTimeout(500)
  return engaged
}

console.log('— press, then drag —')
await p.evaluate(() => window.__map.setZoom(12.5)); await p.waitForTimeout(600)
const z0 = await z()
const engaged = await pressDrag(-220)
ok('the hold engages zoom mode', engaged, 'the map never entered zoom mode')
const z1 = await z()
ok(`hold then drag up zooms in (${z0.toFixed(1)} → ${z1.toFixed(1)})`, z1 > z0 + 0.8, `${z0} → ${z1}`)
await pressDrag(220)
const z2 = await z()
ok(`hold then drag down zooms out (${z1.toFixed(1)} → ${z2.toFixed(1)})`, z2 < z1 - 0.8, `${z1} → ${z2}`)

console.log('\n— a drag WITHOUT the hold still pans —')
await p.evaluate(() => window.__map.setZoom(12.5)); await p.waitForTimeout(600)
const c0 = await centre(); const zBefore = await z()
const panSpot = await emptyPoint()
await p.mouse.move(panSpot.x, panSpot.y); await p.mouse.down()
for (let i=1;i<=12;i++){ await p.mouse.move(panSpot.x, panSpot.y - i*14); await p.waitForTimeout(12) }
await p.mouse.up(); await p.waitForTimeout(700)
const c1 = await centre(); const zAfter = await z()
ok('the map panned', Math.abs(c1.lat - c0.lat) > 0.001, `${c0.lat} → ${c1.lat}`)
ok('...and did NOT zoom', Math.abs(zAfter - zBefore) < 0.1, `${zBefore} → ${zAfter}`)

console.log('\n— you can pull back past the city —')
await p.evaluate(() => window.__map.setZoom(12.5)); await p.waitForTimeout(500)
await p.evaluate(() => window.__map.easeTo({ zoom: 3, duration: 200 })); await p.waitForTimeout(1200)
const far = await z()
ok(`it goes wide (${far.toFixed(1)})`, far < 4, `${far}`)
ok('the min is well below the city', await p.evaluate(() => window.__map.getMinZoom()) < 4)
await p.screenshot({ path:'.impeccable/review/zoom-wide.png' })
ok('markers are quiet out there', await p.evaluate(() =>
  [...document.querySelectorAll('.gmark-label')].every((e) => getComputedStyle(e).opacity === '0' || !e.offsetParent)))

console.log('\n— and a way back from out there —')
// isVisible() is true for an element at opacity 0 — assert what actually
// decides whether a thumb can hit it
const homeState = () => p.evaluate(() => {
  const el = document.querySelector('.map-home')
  const cs = getComputedStyle(el)
  return { opacity: +cs.opacity, hits: cs.pointerEvents !== 'none' }
})
const far1 = await homeState()
ok('the way home appears when you are far out', far1.opacity > 0.9 && far1.hits, JSON.stringify(far1))
await p.locator('.map-home').click(); await p.waitForTimeout(1600)
const home = await z()
ok(`it brings you back to the city (${home.toFixed(1)})`, home > 11.5 && home < 13.5, `${home}`)
const near = await homeState()
ok('...and then gets out of the way', near.opacity < 0.1 && !near.hits, JSON.stringify(near))

await b.close()
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
