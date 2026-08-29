// Keep src/data/venue-events.json honest, on a schedule.
//
// This does the part that cannot break: it prunes shows that have already
// happened, and it says out loud when the calendar is running out. It does NOT
// scrape venues. That was tried first and is not worth building yet — see
// ADAPTERS below for why, and for where a real source would plug in.
//
//   node scripts/refresh-events.mjs            prune, report, write
//   node scripts/refresh-events.mjs --dry-run  report only
//   node scripts/refresh-events.mjs --today=2026-09-08 --dry-run   test the alarm
//
// Exit codes: 0 fine · 1 something is wrong and a human should look.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'src/data/venue-events.json'
const DRY = process.argv.includes('--dry-run')
// Warn while there is still time to do something about it, not after.
const LOW_WATER_DAYS = 10
const MIN_EVENTS = 5

// --today=YYYY-MM-DD exists so the low-water alarm can be tested. A guard that
// has never been seen to fire is not known to work.
const forced = process.argv.find((a) => a.startsWith('--today='))?.split('=')[1]
const today = forced ? new Date(forced + 'T12:00:00') : new Date()
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayKey = key(today)

const before = JSON.parse(readFileSync(FILE, 'utf8'))
if (!Array.isArray(before)) { console.error('events file is not an array — refusing to touch it'); process.exit(1) }

const kept = before.filter((e) => e.date >= todayKey)
const dropped = before.length - kept.length
const horizonDate = kept.length ? kept.map((e) => e.date).sort().at(-1) : null
const horizonDays = horizonDate
  ? Math.round((Date.parse(horizonDate + 'T12:00:00') - Date.parse(todayKey + 'T12:00:00')) / 86400000)
  : 0

console.log(`events file : ${before.length} in, ${kept.length} kept, ${dropped} past shows pruned`)
console.log(`today       : ${todayKey}`)
console.log(`horizon     : ${horizonDate ?? 'none'} (${horizonDays} days out)`)

const byVenue = {}
for (const e of kept) byVenue[e.venue] = (byVenue[e.venue] || 0) + 1
console.log('remaining by venue:', Object.entries(byVenue).map(([v, n]) => `${v} ${n}`).join(' · ') || '(none)')

// A silent empty file is the failure mode worth guarding: the app would simply
// stop showing "On tonight" and nobody would notice for weeks.
const problems = []
if (kept.length < MIN_EVENTS) problems.push(`only ${kept.length} events left (min ${MIN_EVENTS})`)
if (horizonDays < LOW_WATER_DAYS) problems.push(`calendar runs out in ${horizonDays} days (want ${LOW_WATER_DAYS}+)`)

if (!DRY && dropped > 0) {
  writeFileSync(FILE, JSON.stringify(kept, null, 1) + '\n')
  console.log(`\nwrote ${FILE}`)
} else if (DRY) {
  console.log('\n(dry run — nothing written)')
} else {
  console.log('\nnothing to prune')
}

// ---------------------------------------------------------------------------
// ADAPTERS — deliberately empty.
//
// Scraping the five venues that matter was investigated on 2026-08-28 and is
// not worth building yet:
//
//   9:30 Club      homepage is a JS shell; the rendered page exposes 8 FEATURED
//                  shows via .artist-info-container, not the calendar. No
//                  wp-json, no JSON XHR, /calendar/ and /shows/ both 404.
//   Echostage      has a WP REST API at /wp-json/wp/v2/events, but the event
//                  date lives only in the slug — 23 of 30 parse, none carry a
//                  time.
//   Black Cat      server-rendered HTML, no JSON, bespoke selectors.
//   Flash          same, and no robots.txt at all.
//
// robots.txt permits all of it (930 crawl-delay 10, Black Cat 30, Echostage
// allows everything), so this is an engineering judgement, not a policy one:
// five bespoke parsers behind a headless browser, each breaking on redesign,
// to maintain 38 rows.
//
// The clean path is one structured feed instead. Ticketmaster's Discovery API
// has a free tier and returns exact dates, times and venue ids — a single
// integration covering the Live Nation and Ticketmaster rooms. It needs a free
// key, which is why it is not wired up here.
//
// An adapter should be: async () => [{ venue, date: 'YYYY-MM-DD', time: 'HH:MM',
// title }], and MUST throw rather than return [] on failure, so a broken source
// never silently empties the calendar.
const ADAPTERS = []
if (ADAPTERS.length) console.log(`\n${ADAPTERS.length} adapter(s) configured`)

if (problems.length) {
  console.log('\nNEEDS A HUMAN:')
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
}
console.log('\nok')
