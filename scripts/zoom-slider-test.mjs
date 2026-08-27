// One finger, no pinch. node scripts/zoom-slider-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4192/out-dc/'
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const b = await chromium.launch({ channel:'chrome' })
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
await p.goto(BASE + '#/', { waitUntil:'networkidle' })
await p.waitForTimeout(4000)

const zoom = () => p.evaluate(() => window.__map?.getZoom())
const thumbPct = () => p.evaluate(() => {
  const t = document.querySelector('.zoom-track').getBoundingClientRect()
  const th = document.querySelector('.zoom-thumb').getBoundingClientRect()
  return Math.round(((t.bottom - th.top - th.height / 2) / t.height) * 100)
})
const dragTo = async (frac) => {
  const box = await p.locator('.zoom-track').boundingBox()
  const x = box.x + box.width / 2
  const start = box.y + box.height / 2
  const target = box.y + box.height * (1 - frac)
  await p.mouse.move(x, start); await p.mouse.down()
  await p.mouse.move(x, target, { steps: 12 })
  await p.mouse.up(); await p.waitForTimeout(700)
}

console.log('— it is there, on the right, on a phone —')
ok('the slider is visible', await p.locator('.zoom-track').isVisible())
const box = await p.locator('.zoom-track').boundingBox()
ok('on the right edge', box.x > 390 * 0.7, `x=${Math.round(box.x)}`)
// 44px is the platform touch-target floor — a control you have to aim at
// defeats the point of replacing pinch
ok('meets the 44px touch target', box.width >= 44 && box.height >= 120, `${Math.round(box.width)}x${Math.round(box.height)}`)
ok('it does not sit under the nav pill', box.y + box.height < 844 - 90, `bottom=${Math.round(box.y+box.height)}`)

console.log('\n— one finger, dragged up, zooms in —')
const z0 = await zoom()
await dragTo(0.85)
const z1 = await zoom()
ok(`dragging up zoomed in (${z0.toFixed(1)} → ${z1.toFixed(1)})`, z1 > z0 + 0.5, `${z0} → ${z1}`)
await p.screenshot({ path:'.impeccable/review/zoom-slider.png' })

console.log('\n— dragged down, zooms out —')
await dragTo(0.1)
const z2 = await zoom()
ok(`dragging down zoomed out (${z1.toFixed(1)} → ${z2.toFixed(1)})`, z2 < z1 - 0.5, `${z1} → ${z2}`)

console.log('\n— it stays inside the map’s limits —')
await dragTo(1.4)
ok('cannot go past the closest view', (await zoom()) <= 17.6, `${await zoom()}`)
await dragTo(-0.4)
ok('cannot go past the widest view', (await zoom()) >= 10.4, `${await zoom()}`)

console.log('\n— the thumb follows the map, not just its own drag —')
await p.evaluate(() => window.__map.easeTo({ zoom: 15.5, duration: 200 }))
await p.waitForTimeout(900)
const pct = await thumbPct()
const expected = Math.round(((15.5 - 10.5) / 7) * 100)
ok(`the thumb moved to match a zoom it did not cause (${pct}% vs ${expected}%)`,
  Math.abs(pct - expected) < 12, `${pct} vs ${expected}`)

console.log('\n— keyboard works —')
await p.locator('.zoom-track').focus()
const zk = await zoom()
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400)
ok('arrow keys zoom', (await zoom()) < zk, `${zk} → ${await zoom()}`)
await p.keyboard.press('End'); await p.waitForTimeout(500)
ok('End goes to the widest view', Math.abs((await zoom()) - 10.5) < 0.2, `${await zoom()}`)
const aria = await p.locator('.zoom-track').getAttribute('aria-valuetext')
ok('it announces where it is', /Zoom [\d.]+ of/.test(aria || ''), aria)

console.log('\n— desktop keeps buttons, drops the rail —')
await p.setViewportSize({ width: 1512, height: 900 }); await p.waitForTimeout(800)
ok('the rail is hidden', !(await p.locator('.zoom-track').isVisible()))
ok('the buttons remain', await p.locator('.zoom-btn').first().isVisible())

await b.close()
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
