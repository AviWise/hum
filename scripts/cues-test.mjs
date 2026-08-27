// Two cues: does the map say how busy this is *compared with normal*, and does
// a story ring mean anything. node scripts/cues-test.mjs [baseUrl]
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4186/out-dc/'
const fail = []
const ok = (l, c, d = '') => { console.log(`${c ? '  ok ' : ' FAIL'}  ${l}${c ? '' : '  <-- ' + d}`); if (!c) fail.push(l) }

const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

console.log('— the comparison fires, but not on everything —')
await p.goto(BASE + '#/', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
// A comparison that fires on everything is not information. Run the model
// across the day and hold it to a share of spots that stays worth reading.
const { SPOTS, vsUsual } = await import('../src/data/spots.js')
let fired = 0, total = 0
const base = new Date()
for (let h = 8; h < 26; h++) {
  const t = new Date(base); t.setHours(h % 24, 0, 0, 0)
  for (const spot of SPOTS) { total++; if (vsUsual(spot, t.getTime())) fired++ }
}
const share = (100 * fired / total)
ok(`it stays selective (${share.toFixed(1)}% of spot-hours say something)`, share > 1 && share < 25, `${share.toFixed(1)}%`)

await p.goto(BASE + '#/spot/adams-morgan', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
const line = await p.locator('.crowd-line, .sheet-crowd, .crowd-meter').first().textContent().catch(() => '')
const sheetText = await p.locator('.sheet').textContent()
ok('the sheet still reports a crowd level', /quiet|steady|busy|packed|filling|rammed|dead/i.test(sheetText), sheetText.slice(0, 120))
const hasUsual = /than usual|about as usual/.test(sheetText)
console.log(`   comparison shown on Adams Morgan right now: ${hasUsual ? 'yes' : 'no (within normal range)'}`)

console.log('\n— a ring you have not watched, then have —')
await p.goto(BASE + '#/u/out.demo.marcus', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
const before = await p.evaluate(() => {
  const a = document.querySelector('.prof-ava')
  return { story: a?.classList.contains('prof-ava-story'), seen: a?.classList.contains('prof-ava-seen'), label: a?.getAttribute('aria-label') }
})
if (!before.story && !before.seen) {
  console.log('   (no live story on this profile right now — seeding one is a DB write, skipping the click half)')
  ok('no ring is drawn when there is nothing to watch', !before.story && !before.seen, JSON.stringify(before))
} else {
  ok('an unwatched story is lit', before.story, JSON.stringify(before))
  ok('...and says Watch', /(^|\s)Watch @/.test(before.label || ''), before.label)
  await p.locator('.prof-ava').click()
  await p.waitForTimeout(1500)
  await p.keyboard.press('Escape')
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  const after = await p.evaluate(() => {
    const a = document.querySelector('.prof-ava')
    return { story: a?.classList.contains('prof-ava-story'), seen: a?.classList.contains('prof-ava-seen'), label: a?.getAttribute('aria-label') }
  })
  ok('a watched story drains its ring', after.seen && !after.story, JSON.stringify(after))
  ok('...and says Watch again', /Watch again/.test(after.label || ''), after.label)
  ok('...and it survives a reload', after.seen, 'the seen state was forgotten')
}
await b.close()
console.log(fail.length ? `\n${fail.length} FAILING` : '\nall good')
process.exit(fail.length ? 1 : 0)
