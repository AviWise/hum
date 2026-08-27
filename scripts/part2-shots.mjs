import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:5180/hum/'
const b = await chromium.launch({ channel: 'chrome' })
for (const [w, h, tag] of [[390, 844, '390'], [1512, 798, '1512']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await p.goto(BASE + '#/u/out.demo.marcus'); await p.waitForTimeout(11000)
  const ok = await p.evaluate(() => ({
    haunts: !!document.querySelector('.haunts-map.haunts-ready'),
    pins: document.querySelectorAll('.haunt-pin').length,
    tiles: document.querySelectorAll('.prof-tile').length,
    share: !!document.querySelector('.prof-share'),
  }))
  console.log(`${tag}px profile:`, JSON.stringify(ok))
  await p.screenshot({ path: `.impeccable/review/profile-page-${tag}.png` })
  await p.close()
}
await b.close()
