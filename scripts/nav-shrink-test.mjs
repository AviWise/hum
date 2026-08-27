// Does the pill recede while you read, and come back when you want it?
import { chromium } from 'playwright-core'

const BASE = process.argv[2] || 'http://localhost:4174/out-dc/'
const b = await chromium.launch({ channel: 'chrome' })
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const fail = []
const ok = (cond, line) => { console.log(`${cond ? '  ok ' : ' FAIL'}  ${line}`); if (!cond) fail.push(line) }

const nav = () => page.evaluate(() => {
  const pill = document.querySelector('.tabbar-pill').getBoundingClientRect()
  const post = document.querySelector('.tab-post').getBoundingClientRect()
  const lab = document.querySelector('.tab-label')
  const cap = document.querySelector('.tab-cap').getBoundingClientRect()
  // the capsule belongs to the LIT tab, not the first one
  const item = (document.querySelector('.tab-item.tab-lit') || document.querySelector('.tabbar-pill .tab-item')).getBoundingClientRect()
  return {
    small: document.querySelector('.tabbar').classList.contains('nav-small'),
    h: Math.round(pill.height), w: Math.round(pill.width),
    top: Math.round(pill.top), bottom: Math.round(pill.bottom),
    post: Math.round(post.width),
    labels: +getComputedStyle(lab).opacity,
    capOnTab: Math.abs((cap.left + cap.width / 2) - (item.left + item.width / 2)) < 3,
  }
})
const scrollBy = async (dy) => {
  await page.evaluate((d) => document.querySelector('.page').scrollBy({ top: d, behavior: 'instant' }), dy)
  await page.waitForTimeout(60)
}

await page.goto(BASE + '#/feed', { waitUntil: 'networkidle' })
await page.waitForSelector('.tab-cap')
await page.waitForTimeout(900)

const rest = await nav()
console.log('— at rest —')
ok(!rest.small, 'nav is full size')
ok(rest.labels > 0.9, `labels visible (opacity ${rest.labels})`)
console.log(`   pill ${rest.w}x${rest.h}, post ${rest.post}, bottom edge ${rest.bottom}`)

console.log('\n— scrolling down —')
for (let i = 0; i < 6; i++) await scrollBy(120)
await page.waitForTimeout(420)
const s = await nav()
ok(s.small, 'nav went small')
ok(s.h < rest.h, `pill lost ${rest.h - s.h}px of height (${rest.h} -> ${s.h})`)
ok(s.w < rest.w, `pill lost ${rest.w - s.w}px of width (${rest.w} -> ${s.w})`)
ok(s.post < rest.post, `post shrank ${rest.post - s.post}px (${rest.post} -> ${s.post})`)
ok(s.labels < 0.1, `labels folded away (opacity ${s.labels})`)
ok(Math.abs(s.bottom - rest.bottom) < 3, `it shrank in place, bottom edge held (${s.bottom} vs ${rest.bottom})`)
ok(s.capOnTab, 'capsule re-centred on its tab at the new width')

console.log('\n— keeping on scrolling down —')
for (let i = 0; i < 4; i++) await scrollBy(200)
await page.waitForTimeout(300)
ok((await nav()).small, 'still small, no flicker')

console.log('\n— scrolling up brings it back —')
await scrollBy(-160)
await page.waitForTimeout(420)
const back = await nav()
ok(!back.small, 'nav returned to full size')
ok(back.h === rest.h && back.w === rest.w, `back to ${back.w}x${back.h}`)
ok(back.capOnTab, 'capsule still centred on its tab')

console.log('\n— it is full size again at the top —')
await page.evaluate(() => document.querySelector('.page').scrollTo({ top: 900, behavior: 'instant' }))
await page.waitForTimeout(300)
await page.evaluate(() => document.querySelector('.page').scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(420)
ok(!(await nav()).small, 'full size at the top of the page')

console.log('\n— a small pill still drags —')
for (let i = 0; i < 6; i++) await scrollBy(120)
await page.waitForTimeout(420)
ok((await nav()).small, 'small again')
const at = (id) => page.evaluate((i) => {
  const r = document.querySelector(`[data-tab="${i}"]`).getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, id)
const feed = await at('feed'), tonight = await at('tonight')
await page.mouse.move(feed.x, feed.y)
await page.mouse.down()
await page.mouse.move(tonight.x, tonight.y, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(450)
ok(await page.evaluate(() => location.hash) === '#/tonight', `dragged while small (${await page.evaluate(() => location.hash)})`)

console.log('\n— the map page has nothing to scroll, so nothing shrinks —')
await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
ok(!(await nav()).small, 'map keeps the full pill')

console.log('\n— desktop rail ignores all of it —')
await page.setViewportSize({ width: 1512, height: 900 })
await page.goto(BASE + '#/feed', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const railBefore = await page.evaluate(() => document.querySelector('.tabbar').getBoundingClientRect().width)
await page.evaluate(() => document.querySelector('.page').scrollBy({ top: 900, behavior: 'instant' }))
await page.waitForTimeout(420)
const railAfter = await page.evaluate(() => ({
  w: document.querySelector('.tabbar').getBoundingClientRect().width,
  labels: +getComputedStyle(document.querySelector('.tab-label')).opacity,
}))
ok(railAfter.w === railBefore, `rail width unchanged (${railBefore})`)
ok(railAfter.labels > 0.9, 'rail labels never fold away')

await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
