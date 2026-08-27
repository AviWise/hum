import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4180/out-dc/'
const b = await chromium.launch({ channel: 'chrome' })
for (const [w, h, tag] of [[390, 844, '390'], [1512, 950, '1512']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await p.goto(BASE + '#/u/out.demo.nightowls', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2200)
  await p.screenshot({ path: `.impeccable/review/org-profile-${tag}.png`, fullPage: tag === '390' })
  if (tag === '390') {
    console.log(await p.evaluate(() => ({
      name: document.querySelector('.prof-name')?.textContent,
      tag: document.querySelector('.org-tag')?.textContent || null,
      school: document.querySelector('.prof-school')?.textContent || null,
      statLabels: [...document.querySelectorAll('.prof-stat .micro')].map((e) => e.textContent).join('/'),
      badges: document.querySelectorAll('.prof-badges li').length,
      mapLabel: document.querySelector('.block-label')?.textContent,
      pins: document.querySelectorAll('.haunt-pin').length,
      tiles: document.querySelectorAll('.prof-tile').length,
      claimCta: !!document.querySelector('.org-claim-cta'),
    })))
  }
  await p.close()
}
// a person profile must be unchanged
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await p.goto(BASE + '#/u/out.demo.marcus', { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)
console.log('person:', await p.evaluate(() => ({
  orgTag: !!document.querySelector('.org-tag'),
  statLabels: [...document.querySelectorAll('.prof-stat .micro')].map((e) => e.textContent).join('/'),
  badges: document.querySelectorAll('.prof-badges li').length,
  mapLabel: document.querySelector('.block-label')?.textContent,
})))
await b.close()
