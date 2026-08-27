import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:5180/out-dc/'
const b = await chromium.launch({ channel: 'chrome' })

// relative luminance contrast, WCAG
const lum = ([r, g, b2]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b2) }
const ratio = (a, c) => { const L1 = Math.max(lum(a), lum(c)), L2 = Math.min(lum(a), lum(c)); return (L1 + 0.05) / (L2 + 0.05) }

for (const [w, h] of [[390, 844], [430, 932]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  await p.goto(BASE); await p.waitForTimeout(8000)

  // 1. map — and the pale northwest quadrant specifically
  await p.evaluate(() => window.__map.jumpTo({ center: [-77.075, 38.95], zoom: 13.2 }))
  await p.waitForTimeout(2500)
  await p.screenshot({ path: `.impeccable/review/pill-${w}-map-pale.png` })
  const contrast = await p.evaluate(() => {
    const el = document.querySelector('.tabbar-pill .tab-item:not(.tab-on) .tab-label')
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      color: getComputedStyle(el).color }
  })
  console.log(`${w}px pale-map label colour ${contrast.color}`)

  // 2. feed, and the last row must clear the pill
  await p.click('.tab-item:has-text("Feed")'); await p.waitForTimeout(2800)
  await p.evaluate(() => { const s = document.querySelector('.page'); s.scrollTop = s.scrollHeight })
  await p.waitForTimeout(1200)
  const clearance = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.mas-card')]
    const last = cards[cards.length - 1]?.getBoundingClientRect()
    const pill = document.querySelector('.tabbar-pill').getBoundingClientRect()
    const stop = document.querySelector('.stopping-line')?.getBoundingClientRect()
    return { lastCardBottom: Math.round(last?.bottom ?? 0), pillTop: Math.round(pill.top),
      stoppingLineVisible: stop ? Math.round(stop.bottom) <= Math.round(pill.top) : 'n/a' }
  })
  console.log(`${w}px feed bottom: last card ends ${clearance.lastCardBottom}, pill starts ${clearance.pillTop}, stopping line clear: ${clearance.stoppingLineVisible}`)
  await p.screenshot({ path: `.impeccable/review/pill-${w}-feed.png` })

  // 3. tonight
  await p.click('.tab-item:has-text("Tonight")'); await p.waitForTimeout(2800)
  await p.screenshot({ path: `.impeccable/review/pill-${w}-tonight.png` })

  // 4. story viewer
  const by = await p.$('.tp-hero-by, .ev-by-link')
  if (by) { await by.click(); await p.waitForTimeout(2200) }
  const live = await p.$('.prof-live')
  if (live) { await live.click(); await p.waitForTimeout(2200) }
  const story = await p.evaluate(() => {
    const sc = document.querySelector('.story-scrim')
    if (!sc) return { open: false }
    const pill = document.querySelector('.tabbar-pill')
    const pz = +getComputedStyle(pill.closest('.tabbar')).zIndex
    const sz = +getComputedStyle(sc).zIndex
    return { open: true, storyZ: sz, navZ: pz, navCoveredByStory: sz > pz }
  })
  console.log(`${w}px story viewer:`, JSON.stringify(story))
  await p.screenshot({ path: `.impeccable/review/pill-${w}-story.png` })
  await p.close()
}
await b.close()
