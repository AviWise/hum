// The AU COMMUNITY page: the people, not the campus — what it shows, what it
// does not offer, and that the link shipped an hour ago still works.
import { chromium } from 'playwright-core'
const BASE = process.argv[2] || 'http://localhost:4195/out-dc/'
const fail=[]; const ok=(l,c,d='')=>{console.log(`${c?'  ok ':' FAIL'}  ${l}${c?'':'  <-- '+d}`); if(!c)fail.push(l)}
const b = await chromium.launch({ channel:'chrome' })
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 })
await p.goto(BASE + '#/c/american.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(3000)

console.log('— the page —')
ok('it names the school', (await p.locator('.prof-name').textContent()) === 'American')
ok('and its domain', (await p.locator('.prof-user').textContent())?.includes('american.edu'))
const note = await p.locator('.school-note').textContent()
ok('it says nobody owns it', note?.includes('belongs to') && note?.includes('nobody'), note)
ok('and frames it as the people, not the campus', /the people, not the campus/.test(note || ''), note)
ok('it is tagged a community', (await p.locator('.prof-user').textContent())?.includes('Community'))
ok('the groups there are listed', (await p.locator('.sheet, .page').textContent()).includes('AU Test Group'))
ok('the place is a separate section', (await p.locator('.page').textContent()).includes('Where this community goes'))
ok('with spots around campus', await p.locator('.prof-grid .prof-tile').count() >= 6,
   `${await p.locator('.prof-grid .prof-tile').count()} tiles`)
await p.screenshot({ path:'.impeccable/review/school-au.png', fullPage:true })

console.log('\n— nothing here offers ownership —')
const text = await p.locator('.page').textContent()
ok('no claim button', !/claim (this|the) (school|university|page)/i.test(text), text.slice(0,200))
ok('no follow/own affordance for the school itself', await p.locator('.org-claim-cta').count() === 0)

console.log('\n— it links onward, and back —')
await p.locator('.dm-thread').first().click(); await p.waitForTimeout(2000)
ok('a group opens from here', (await p.evaluate(() => location.hash)).startsWith('#/o/'),
   await p.evaluate(() => location.hash))
ok('and the group links back to its school',
   await p.locator('.prof-school-link').count() === 1)
await p.locator('.prof-school-link').click(); await p.waitForTimeout(2000)
ok('which returns here', await p.evaluate(() => location.hash) === '#/c/american.edu',
   await p.evaluate(() => location.hash))

console.log('\n— the older link still works —')
await p.goto(BASE + '#/school/american.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(2500)
ok('#/school/ still lands on the community', (await p.locator('.prof-name').textContent()) === 'American',
   await p.locator('.prof-name').textContent().catch(() => '(nothing)'))

console.log('\n— a school that does not exist —')
await p.goto(BASE + '#/c/notreal.edu', { waitUntil:'networkidle' })
await p.waitForTimeout(2000)
ok('says so plainly', (await p.locator('.empty-line').textContent())?.includes('No school here'))

await b.close()
console.log(fail.length?`\n${fail.length} FAILING`:'\nall good')
process.exit(fail.length?1:0)
