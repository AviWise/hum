import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4174/hum/'
const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const at = (id) => page.evaluate((i) => {
  const r = document.querySelector(`[data-tab="${i}"]`).getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, id)
const shot = (n) => page.screenshot({ path: `.impeccable/review/${n}.png`, clip: { x: 0, y: 640, width: 390, height: 204 } })
await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const map = await at('map'), tonight = await at('tonight'), you = await at('you')
await shot('drag-0-rest')
await page.mouse.move(map.x, map.y); await page.mouse.down()
await page.mouse.move((map.x + tonight.x) / 2, map.y, { steps: 6 })
await shot('drag-1-between')
await page.mouse.move(you.x + 80, map.y, { steps: 8 })
await shot('drag-2-stretched')
await page.mouse.move(tonight.x, map.y, { steps: 6 }); await page.mouse.up()
await page.waitForTimeout(600)
await shot('drag-3-committed')
await b.close(); console.log('shots written')
