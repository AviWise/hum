// Sweep every surface for stretched, distorted or oversized images.
// A distorted image = rendered aspect ratio differs from the file's natural
// ratio while nothing (object-fit) is supposed to be cropping it.
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:5180/out-dc/'
const browser = await chromium.launch({ channel: 'chrome' })

const audit = (page) => page.evaluate(() => {
  const out = []
  for (const img of document.querySelectorAll('img')) {
    const r = img.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const cs = getComputedStyle(img)
    const nat = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null
    const shown = r.width / r.height
    const cropping = cs.objectFit === 'cover' || cs.objectFit === 'contain'
    const distorted = nat && !cropping && Math.abs(shown - nat) / nat > 0.05
    // a deliberately full-bleed image (story backdrop) is not a bug: it is
    // pinned to its container and cropping, not stretching
    const fullBleed = cropping && (cs.position === 'absolute' || cs.position === 'fixed')
    const huge = !fullBleed && r.height > Math.max(700, innerHeight * 0.85)
    if (distorted || huge) {
      out.push({
        cls: img.className || '(none)',
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        natural: nat ? nat.toFixed(2) : '?',
        rendered: shown.toFixed(2),
        objectFit: cs.objectFit,
        cssHeight: cs.height,
        why: distorted ? 'DISTORTED' : 'OVERSIZED',
      })
    }
  }
  return out
})

const surfaces = []
for (const [w, h, tag] of [[390, 844, 'mobile'], [1440, 900, 'desktop']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const visit = async (name, fn) => {
    try { await fn() } catch (e) { surfaces.push({ tag, name, imgs: 0, bad: [], skipped: e.message.split('\n')[0].slice(0, 60) }); return }
    const bad = await audit(page)
    const count = await page.evaluate(() => document.querySelectorAll('img').length)
    surfaces.push({ tag, name, imgs: count, bad })
  }

  await visit('map', async () => { await page.goto(BASE); await page.waitForTimeout(8000) })
  await visit('tonight', async () => { await page.click('.tab-item:has-text("Tonight")'); await page.waitForTimeout(3000) })
  await visit('feed', async () => { await page.click('.tab-item:has-text("Feed")'); await page.waitForTimeout(3000) })
  await visit('feed (scrolled)', async () => { await page.evaluate(() => window.scrollTo(0, 2000)); await page.waitForTimeout(2500) })
  await visit('search', async () => {
    await page.click('.tab-item:has-text("Map")'); await page.waitForTimeout(1200)
    // the search entry lives in the top bar on phones and the rail on desktop
    for (const sel of ['.tab-item:has-text("Search")', '[aria-label="Search"]']) {
      const el = await page.$(sel)
      if (el && await el.isVisible()) { await el.click(); break }
    }
    await page.waitForTimeout(1500)
  })
  await visit('spot sheet', async () => {
    await page.keyboard.press('Escape')
    await page.goto(`${BASE}?spot=lincoln`); await page.waitForTimeout(8000)
  })
  await visit('spot sheet (scrolled)', async () => {
    await page.evaluate(() => { const s = document.querySelector('.sheet'); if (s) s.scrollTop = s.scrollHeight })
    await page.waitForTimeout(1800)
  })
  await visit('profile', async () => {
    await page.goto(BASE); await page.waitForTimeout(7000)
    await page.click('.tab-item:has-text("Tonight")'); await page.waitForTimeout(2500)
    const by = await page.$('.ev-by-link, .tp-hero-by')
    if (by) { await by.click(); await page.waitForTimeout(2000) }
  })
  await visit('story', async () => {
    const cta = await page.$('.prof-story-cta')
    if (cta) { await cta.click(); await page.waitForTimeout(2200) }
  })
  await visit('post sheet', async () => {
    await page.keyboard.press('Escape')
    await page.goto(BASE); await page.waitForTimeout(7000)
    await page.click('.tab-post'); await page.waitForTimeout(1500)
  })
  await page.close()
}

let bad = 0
for (const s of surfaces) {
  if (s.skipped) { console.log(`${s.tag.padEnd(8)} ${s.name.padEnd(20)} skipped: ${s.skipped}`); continue }
  const flag = s.bad.length ? `  <-- ${s.bad.length} PROBLEM` : ''
  console.log(`${s.tag.padEnd(8)} ${s.name.padEnd(20)} ${String(s.imgs).padStart(3)} imgs${flag}`)
  for (const b of s.bad) { bad++; console.log('   ', JSON.stringify(b)) }
}
console.log(bad ? `\n${bad} image problem(s) found` : '\nno stretched, distorted or oversized images on any surface')
await browser.close()
