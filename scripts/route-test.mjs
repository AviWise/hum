import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:5180/out-dc/'
const b = await chromium.launch({ channel: 'chrome' })

// 1. every route cold-loads into the right view
console.log('— cold loads —')
for (const [hash, expect] of [
  ['#/', 'map'], ['#/tonight', 'Tonight'], ['#/feed', 'feed'],
  ['#/u/out.demo.marcus', 'Marcus'], ['#/spot/carnegie-library', 'Carnegie'],
]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(BASE + hash); await p.waitForTimeout(9000)
  const seen = await p.evaluate(() => ({
    page: document.querySelector('.page-title')?.textContent || document.querySelector('.tp-headline')?.textContent || null,
    profile: document.querySelector('.prof-name')?.textContent || null,
    sheet: document.querySelector('.sheet-name')?.textContent || null,
    haunts: !!document.querySelector('.haunts-map'),
    tabOn: document.querySelector('.tab-item.tab-on .tab-label')?.textContent || null,
  }))
  const got = seen.profile || seen.sheet || seen.page || 'map'
  console.log(`${hash.padEnd(24)} -> ${String(got).slice(0, 26).padEnd(28)} tab:${seen.tabOn}  ${errs.length ? 'ERR ' + errs[0].slice(0, 40) : ''}`)
  await p.close()
}

// 2. a real back/forward chain
console.log('\n— feed -> profile -> spot -> back -> back —')
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(BASE); await p.waitForTimeout(9000)
const trace = async (label) => {
  const s = await p.evaluate(() => ({
    hash: location.hash,
    view: document.querySelector('.prof-name')?.textContent
      || document.querySelector('.sheet-name')?.textContent
      || document.querySelector('.page-title')?.textContent || document.querySelector('.tp-headline')?.textContent || 'map',
    scroll: Math.round(document.querySelector('.page')?.scrollTop ?? 0),
  }))
  console.log(`${label.padEnd(22)} ${s.hash.padEnd(26)} ${s.view.slice(0, 22).padEnd(24)} scroll:${s.scroll}`)
  return s
}
await p.click('.tab-item:has-text("Feed")'); await p.waitForTimeout(2800)
await p.evaluate(() => { document.querySelector('.page').scrollTop = 600 }); await p.waitForTimeout(900)
await trace('feed (scrolled)')
// tap something already on screen: playwright's click scrolls into view first,
// which would move the page before the snapshot and fake a restore failure
await p.evaluate(() => { const el=[...document.querySelectorAll('.mas-by')].find(e=>{const r=e.getBoundingClientRect();return r.top>60&&r.bottom<innerHeight-120}); el?.click() })
await p.waitForTimeout(2600)
await trace('-> profile')
await p.evaluate(() => document.querySelector('.prof-tile')?.click())
await p.waitForTimeout(3200)
await trace('-> spot')
await p.goBack(); await p.waitForTimeout(2600); await trace('back')
await p.goBack(); await p.waitForTimeout(2600); await trace('back')
await p.goForward(); await p.waitForTimeout(2600); await trace('forward')
await p.close()
await b.close()
