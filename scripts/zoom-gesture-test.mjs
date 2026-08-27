// One-finger zoom is MapLibre's own tapDragZoom — double-tap, hold, drag up or
// down. It is the Snapchat and Google Maps gesture and needs no chrome on the
// map. This test exists so nobody (me) disables it or builds a slider for it a
// second time.
//
// What it does NOT do is drive the gesture. CDP synthetic touch events do not
// reach the map canvas here — markers overlay it, and even a two-finger pinch
// dispatched this way moves the zoom not at all, which proves the harness is
// the problem rather than the map. Asserting a gesture this way would produce
// a green tick that means nothing, so it asserts the handler state instead and
// says plainly that the gesture itself needs a real thumb.
//
// node scripts/zoom-gesture-test.mjs [baseUrl]
import { chromium } from 'playwright-core'

const BASE = process.argv[2] || 'http://localhost:4193/out-dc/'
const fail = []
const ok = (l, c, d = '') => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}${c ? '' : '  <-- ' + d}`); if (!c) fail.push(l) }

const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
await p.goto(BASE + '#/', { waitUntil: 'networkidle' })
await p.waitForTimeout(4500)

console.log('— the handlers that make one-finger zoom possible —')
const handlers = await p.evaluate(() => ({
  touch: window.__map.touchZoomRotate.isEnabled(),
  dbl: window.__map.doubleClickZoom.isEnabled(),
  drag: window.__map.dragPan.isEnabled(),
}))
ok('touch zoom / rotate is enabled (this carries tapDragZoom)', handlers.touch)
ok('double-tap zoom is enabled', handlers.dbl)
ok('panning is enabled', handlers.drag)
ok('the canvas takes its own touches', await p.evaluate(() =>
  getComputedStyle(document.querySelector('.maplibregl-canvas')).touchAction === 'none'))

console.log('\n— and the map carries no zoom furniture on a phone —')
ok('no zoom slider', await p.locator('.zoom-track').count() === 0)
ok('no zoom buttons', !(await p.locator('.zoomer').isVisible().catch(() => false)))

console.log('\n— desktop gets buttons, where there is no thumb —')
const wide = await b.newPage({ viewport: { width: 1512, height: 950 } })
await wide.goto(BASE + '#/', { waitUntil: 'networkidle' })
await wide.waitForTimeout(4000)
ok('the +/− buttons are there', await wide.locator('.zoom-btn').first().isVisible())

console.log('\n  NOTE: double-tap-hold-drag itself is unverified by this test —')
console.log('        it needs a real thumb on a real phone.')
await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
