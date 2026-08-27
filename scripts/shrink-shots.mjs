import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4174/hum/'
const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const shot = (n) => page.screenshot({ path: `.impeccable/review/${n}.png`, clip: { x: 0, y: 690, width: 390, height: 154 } })
await page.goto(BASE + '#/feed', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('shrink-0-full')
for (let i = 0; i < 6; i++) { await page.evaluate(() => document.querySelector('.page').scrollBy({ top: 120, behavior: 'instant' })); await page.waitForTimeout(60) }
await page.waitForTimeout(500)
await shot('shrink-1-small')
await page.evaluate(() => document.querySelector('.page').scrollBy({ top: -160, behavior: 'instant' }))
await page.waitForTimeout(500)
await shot('shrink-2-back')
await b.close(); console.log('shots written')
