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
//   node scripts/refresh-events.mjs --check-key                     is the key live?
//   node scripts/refresh-events.mjs --map-venues                    what does TM call our venues?
//   node scripts/refresh-events.mjs --no-fetch --today=2026-09-30    prove the alarm fires
//
// With TICKETMASTER_KEY set it also PULLS fresh line-ups. Without one it still
// prunes and warns, which is the part that cannot break.
//
// Exit codes: 0 fine · 1 something is wrong and a human should look.
import { readFileSync, writeFileSync } from 'node:fs'
import { readKey, fetchEvents, lookupVenues, matchVenue } from './lib/ticketmaster.mjs'
import { VENUE_INFO } from '../src/data/venueinfo.js'

const FILE = 'src/data/venue-events.json'
const DRY = process.argv.includes('--dry-run')
// --no-fetch exists so the low-water alarm stays testable. With a live key the
// fetch always returns a fresh 60 days, so the calendar can never be seen to
// run out, and a guard that cannot be seen to fire is not known to work.
const NO_FETCH = process.argv.includes('--no-fetch')
// Warn while there is still time to do something about it, not after.
const LOW_WATER_DAYS = 10
const MIN_EVENTS = 5

// --today=YYYY-MM-DD exists so the low-water alarm can be tested. A guard that
// has never been seen to fire is not known to work.
const forced = process.argv.find((a) => a.startsWith('--today='))?.split('=')[1]
const today = forced ? new Date(forced + 'T12:00:00') : new Date()
// Washington's date, not the runner's. GitHub Actions run in UTC, and a job
// firing at 03:32 UTC decided it was already the 29th and pruned four shows
// that were still going on in DC at 23:32 the night before. The scheduled run
// at 12:40 UTC happens to be the same calendar day either way; a manual run in
// the evening is not. en-CA because it formats as YYYY-MM-DD.
const DC_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
})
const key = (d) => DC_DATE.format(d)
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

// ---------------------------------------------------------------------------
// SOURCE — Ticketmaster Discovery API.
//
// Chosen over scraping after investigating the venues directly on 2026-08-28:
// 9:30 Club's homepage is a JS shell exposing 8 featured shows rather than its
// calendar, Echostage's WP API hides the date in a slug (23 of 30 parse, none
// carry a time), and Black Cat and Flash each need bespoke selectors. Five
// parsers behind a headless browser, each breaking on redesign, versus one
// structured feed with exact dates and times.
//
// Hand-curated rows are preserved. Only rows this source previously wrote
// (source: 'ticketmaster') are replaced, so Avi's own entries are never
// clobbered by a refresh.
const tmKey = readKey()
const HORIZON_DAYS = 60

if (process.argv.includes('--map-venues')) {
  // The alias map in lib/ticketmaster.mjs is a guess at Ticketmaster's naming.
  // This is how you replace the guess with facts.
  if (!tmKey) { console.error('\nno TICKETMASTER_KEY found in env or .env'); process.exit(1) }
  const ours = Object.keys(VENUE_INFO)
  const rows = await lookupVenues({ key: tmKey, names: ours })
  let unmatched = 0
  console.log('\nour venue -> what Ticketmaster calls it\n')
  for (const { ours: name, found } of rows) {
    if (!found.length) { console.log(`  ${name.padEnd(34)} (not in their index)`); continue }
    const top = found[0]
    const resolves = matchVenue(top.name, ours)
    const flag = resolves === name ? 'ok  ' : 'CHECK'
    if (resolves !== name) unmatched++
    console.log(`  ${flag} ${name.padEnd(34)} "${top.name}" [${top.id}] ${top.city}`)
    if (resolves !== name) console.log(`        ^ our matcher resolves that to ${resolves ?? 'nothing'} — add an alias`)
  }
  console.log(`\n${rows.length} looked up, ${unmatched} need an alias`)
  process.exit(unmatched ? 1 : 0)
}

if (process.argv.includes('--check-key')) {
  if (!tmKey) { console.error('\nno TICKETMASTER_KEY found in env or .env'); process.exit(1) }
  try {
    const probe = await fetchEvents({
      key: tmKey, fromISO: new Date().toISOString().slice(0, 19) + 'Z',
      toISO: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 19) + 'Z',
      knownVenues: Object.keys(VENUE_INFO), maxPages: 1,
    })
    console.log(`\nkey works — ${probe.length} events matched our venues in the next 60 days`)
    for (const e of probe.slice(0, 8)) console.log(`  ${e.date} ${e.time}  ${e.venue} — ${e.title}`)
    process.exit(0)
  } catch (e) { console.error('\nkey check failed:', e.message); process.exit(1) }
}

let merged = kept
if (tmKey && !NO_FETCH) {
  const fromISO = new Date(todayKey + 'T00:00:00Z').toISOString().slice(0, 19) + 'Z'
  const toISO = new Date(Date.parse(todayKey + 'T00:00:00Z') + HORIZON_DAYS * 86400000).toISOString().slice(0, 19) + 'Z'
  // Deliberately NOT wrapped in a try/catch that swallows: if the source is
  // broken we want the job to fail loudly with the old calendar intact, not to
  // quietly write a shorter one.
  const fresh = await fetchEvents({ key: tmKey, fromISO, toISO, knownVenues: Object.keys(VENUE_INFO) })
  const manual = kept.filter((e) => e.source !== 'ticketmaster')

  // Dedupe on how much two titles actually share, not on string containment.
  //
  // The same night gets described three ways: the venue's feed, a hand-typed
  // row, and sometimes Ticketmaster itself listing one show twice under
  // different ticket types. "LUCKI" against "LUCKI — Bad Influence Tour",
  // "Hugel [Early Show]" against "HUGEL (early show)", "Devotchka" against
  // "DeVotchKa — Little Miss Sunshine tribute". Substring containment missed
  // all of those, mostly because short artist names fell under the length
  // guard that stops "The" matching everything.
  //
  // Token overlap does not care about word order, punctuation, brackets or
  // which version is longer.
  const slug = (t) => String(t).toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')      // "(sold out)", "[Early Show]"
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const tokens = (t) => new Set(slug(t).split(' ').filter(Boolean))
  const sameShow = (a, b) => {
    const x = tokens(a), y = tokens(b)
    if (!x.size || !y.size) return false
    let shared = 0
    for (const w of x) if (y.has(w)) shared++
    return shared / Math.min(x.size, y.size) > 0.6
  }

  // Ticketmaster wins a collision: it is the venue's own listing, and it knows
  // about cancellations and sold-out states a transcription cannot.
  const rank = (e) => (e.source === 'ticketmaster' ? 1 : 0)
  const all = [...fresh, ...manual].sort((a, b) => rank(b) - rank(a) || b.title.length - a.title.length)

  const out = []
  let collapsed = 0
  for (const e of all) {
    const clash = out.find((k) => k.venue === e.venue && k.date === e.date && sameShow(k.title, e.title))
    if (clash) { collapsed++; continue }
    out.push(e)
  }
  merged = out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  if (collapsed) console.log(`  ${collapsed} duplicate listing(s) of the same show collapsed`)
  console.log(`\nticketmaster : ${fresh.length} events pulled, ${manual.length} hand-curated kept, ${merged.length} total`)
} else if (NO_FETCH) {
  console.log('\nticketmaster : --no-fetch, pruning only')
} else {
  console.log('\nticketmaster : no TICKETMASTER_KEY — pruning only. Add one and this pulls fresh line-ups.')
}

const finalHorizon = merged.length ? merged.map((e) => e.date).sort().at(-1) : null
const finalDays = finalHorizon
  ? Math.round((Date.parse(finalHorizon + 'T12:00:00') - Date.parse(todayKey + 'T12:00:00')) / 86400000)
  : 0

const problems = []
if (merged.length < MIN_EVENTS) problems.push(`only ${merged.length} events left (min ${MIN_EVENTS})`)
if (finalDays < LOW_WATER_DAYS) problems.push(`calendar runs out in ${finalDays} days (want ${LOW_WATER_DAYS}+)`)

const changed = JSON.stringify(merged) !== JSON.stringify(before)
if (!DRY && changed) {
  writeFileSync(FILE, JSON.stringify(merged, null, 1) + '\n')
  console.log(`\nwrote ${FILE} — ${merged.length} events, horizon ${finalHorizon ?? 'none'} (${finalDays} days)`)
} else if (DRY) {
  console.log(`\n(dry run — would write ${merged.length} events, horizon ${finalDays} days)`)
} else {
  console.log('\nnothing changed')
}

if (problems.length) {
  console.log('\nNEEDS A HUMAN:')
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
}
console.log('\nok')
