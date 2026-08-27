// out. — event radar.
//
// Pulls the D.C. sources that publish a feed, finds the items that look like
// things happening, matches them to spots we already map, and writes a digest
// of what is NEW since the last run. Nothing is published automatically: a
// wrong event on the map costs more trust than a missing one, so the last step
// is always a person saying yes.
//
//   node scripts/watch-sources.mjs            # new since last run
//   node scripts/watch-sources.mjs --all      # ignore the seen-list
//   node scripts/watch-sources.mjs --days 14  # widen the date window
//
// Sources that block robots (Axios 403, Smithsonian 403) or publish no feed
// (730DC, CultureCapital, Free in DC, Embassy Experiences) are listed at the
// end of the digest as a manual checklist rather than scraped around.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const UA = 'out-dc-radar/0.1 (+https://aviwise.github.io/out-dc/; personal student project)'
const DIR = 'scripts/watch'
const SEEN = `${DIR}/seen.json`
const args = process.argv.slice(2)
const ALL = args.includes('--all')
// --days 14 or --days=14; anything else leaves the default alone
function argNumber(flag, fallback) {
  const joined = args.find((a) => a.startsWith(`${flag}=`))
  if (joined) return Number(joined.split('=')[1]) || fallback
  const i = args.indexOf(flag)
  if (i >= 0 && args[i + 1]) return Number(args[i + 1]) || fallback
  return fallback
}
const DAYS = argNumber('--days', 21)

const FEEDS = [
  { name: 'r/washingtondc', url: 'https://www.reddit.com/r/washingtondc/.rss', weight: 2 },
  { name: 'Clockout DC', url: 'https://clockoutdc.substack.com/feed', weight: 3 },
  { name: 'Not Bored in DC', url: 'https://notboredindc.substack.com/feed', weight: 3 },
  { name: 'PoPville', url: 'https://www.popville.com/feed/', weight: 2 },
  { name: 'East City Art', url: 'https://www.eastcityart.com/feed/', weight: 2 },
  { name: 'Golden Triangle BID', url: 'https://goldentriangledc.com/feed/', weight: 2 },

  // news desks: the event has to be the headline, not a mention in the body
  { name: 'Washingtonian', url: 'https://www.washingtonian.com/feed/', weight: 2, headlineOnly: true },
  { name: 'WAMU', url: 'https://wamu.org/feed/', weight: 1, headlineOnly: true },
  { name: 'Washington City Paper', url: 'https://washingtoncitypaper.com/feed/', weight: 2, headlineOnly: true },
  { name: 'Washington Blade', url: 'https://www.washingtonblade.com/feed/', weight: 2, headlineOnly: true },
  { name: 'NPS National Mall', url: 'https://www.nps.gov/feeds/getnewsrss.htm?id=nama', weight: 2, headlineOnly: true },

  // campus calendars: every item is already an event, so they skip the
  // does-this-name-an-event test and get the academic-noise filter instead
  { name: 'Georgetown events', url: 'https://events.georgetown.edu/live/rss/events', weight: 3, eventFeed: true },
  { name: 'GW events', url: 'https://calendar.gwu.edu/calendar.xml', weight: 3, eventFeed: true },
  { name: 'American U events', url: 'https://american.campuslabs.com/engage/events.rss', weight: 3, eventFeed: true },

  // campus subreddits — where students actually say what's on
  { name: 'r/gwu', url: 'https://www.reddit.com/r/gwu/.rss', weight: 2 },
  { name: 'r/Georgetown', url: 'https://www.reddit.com/r/georgetown/.rss', weight: 2 },
  { name: 'r/HowardUniversity', url: 'https://www.reddit.com/r/HowardUniversity/.rss', weight: 2 },
  { name: 'r/AmericanU', url: 'https://www.reddit.com/r/AmericanU/.rss', weight: 2 },
]

const MANUAL = [
  ['Axios DC — Weekend Ahead (Fri)', 'blocks automated readers (403); read the Friday email'],
  ['730DC', 'daily newsletter, no feed published'],
  ['Smithsonian events', 'blocks automated readers (403); si.edu/events'],
  ['CultureCapital', 'domain does not resolve from here; culturecapital.com'],
  ['Free in DC', 'no feed published; freeindc.org'],
  ['Embassy Experiences / Intl Club', 'no feed published'],
]

// --- what counts as "something happening" -----------------------------------
// A thing has to BE an event, not merely mention one. Strong nouns name the
// event itself; weak words only help once a strong noun is already present.
const STRONG = /\b(festival|fest|concert|show|gig|dj set|live music|open house|opening night|grand opening|block party|pop-?up|night market|farmers market|parade|screening|film series|movie night|exhibit|exhibition|happy hour|trivia night|karaoke|drag (?:brunch|show|bingo)|comedy (?:night|show)|state fair|fair\b|celebration|anniversary party|fireworks|marathon|5k|race|tour\b|reading|book talk|lineup|matinee|residency|watch party|game day)\b/i
const WEAK = /\b(tonight|tomorrow|this weekend|weekend|friday|saturday|sunday|free|tickets|doors at|kicks off|returns|debuts)\b/i
const DATEISH = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\b\d{1,2}(?:st|nd|rd|th)\b|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i
const NOISE = /\b(shooting|stabbed|arrest|crash|died|death|fire at|robbery|assault|lawsuit|indicted|charged with|obituary|missing person|carjack|tax bill|rant|witness|scam|towed|bed bugs?|roommate|sublet|hiring|for sale|giving away)\b/i
// help-me / opinion posts read like events but are neither
const ASKING = /^(is |are |does |do |any |anyone |anybody |where (?:can|should|to)|what(?:'s| is| are)|which |how (?:do|can|to)|why |looking for|seeking|need (?:help|advice|a )|recommendations?|suggestions?|advice|help[!:, ])/i
// the weekly crowdsourced guide is the single highest-value item in the set
const FLAGSHIP = /weekend guide|things to do this weekend|weekend ahead|what'?s on this week/i
// a university calendar is mostly coursework; keep the part a student would
// actually go to on a night off
const ACADEMIC = /\b(dissertation|thesis|defense|faculty|advising|info session|information session|orientation|registration|enrollment|midterm|finals|office hours|webinar|training|colloquium|symposium|seminar|workshop|career|job fair|resum|recruit|internship|networking|professional development|employer|alumni|board meeting|town hall|convocation|commencement|deadline|application|tutoring|study (?:hall|session)|exam|club fair|org fair|interest meeting|general body|GBM\b|volunteer|fundrais|blood drive|vaccination|flu shot|teaching|conference|research center|5k club|open house at|welcome back open)\b/i

const spotsSrc = readFileSync('src/data/spots.js', 'utf8')
const SPOTS = []
for (const m of spotsSrc.matchAll(/id: '([\w]+)', name: '([^']+)'[^\n]*area: '([^']+)'/g)) {
  SPOTS.push({ id: m[1], name: m[2], area: m[3] })
}
const VENUES = []
// Only distinctive venue names are safe to match on: a bare common noun like
// "Pizza" or "Bookstore" will hit half the city.
const GENERIC = /^(pizza|coffee|café|cafe|bar|bookstore|market|library|museum|theater|theatre|gallery|park|garden|club|diner|deli|brewery|arena|stadium|records?|patio|rooftop|courtyard|pool|trail|dog park)$/i
for (const m of spotsSrc.matchAll(/id: '([\w]+)'[\s\S]{0,700}?venues: \[([^\]]+)\]/g)) {
  for (const v of m[2].matchAll(/['"]([^'"]{3,})['"]/g)) {
    const venue = v[1].replace(/\s*\([^)]*\)\s*/g, '').trim()
    if (GENERIC.test(venue)) continue
    // needs to be a real name: two words, or one long distinctive one
    if (venue.split(/\s+/).length < 2 && venue.length < 9) continue
    VENUES.push({ id: m[1], venue })
  }
}

const strip = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

function parseFeed(xml) {
  const items = []
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || []
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
      return m ? strip(m[1]) : ''
    }
    let link = pick('link')
    if (!link) link = (b.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || ''
    const date = pick('pubDate') || pick('published') || pick('updated')
    items.push({
      title: pick('title')
        .replace(/\s+at Sign in to download the location\s*$/i, '')
        .replace(/^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}):\s*/i, ''),
      summary: (pick('description') || pick('summary') || pick('content')).slice(0, 400),
      link,
      date: date ? new Date(date) : null,
    })
  }
  return items
}

// --- pull -------------------------------------------------------------------
mkdirSync(DIR, { recursive: true })
const seen = existsSync(SEEN) && !ALL ? new Set(JSON.parse(readFileSync(SEEN, 'utf8'))) : new Set()
const seenAll = existsSync(SEEN) ? new Set(JSON.parse(readFileSync(SEEN, 'utf8'))) : new Set()
const cutoff = Date.now() - DAYS * 864e5
const found = []
const health = []
const titlesSeen = new Set()

// Be a good citizen: cache raw feed bodies briefly so repeated runs don't
// re-ask, back off when a host says slow down, and space the requests out.
const CACHE = `${DIR}/cache`
mkdirSync(CACHE, { recursive: true })
const CACHE_MS = 10 * 60 * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchFeed(f) {
  const file = `${CACHE}/${f.name.replace(/\W+/g, '_')}.xml`
  if (existsSync(file) && Date.now() - Date.parse(JSON.parse(readFileSync(`${file}.meta`, 'utf8')).at) < CACHE_MS) {
    return { body: readFileSync(file, 'utf8'), cached: true }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(f.url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } })
    if (r.ok) {
      const body = await r.text()
      writeFileSync(file, body)
      writeFileSync(`${file}.meta`, JSON.stringify({ at: new Date().toISOString() }))
      return { body, cached: false }
    }
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue }
    return { error: `http ${r.status}` }
  }
  // rate-limited even after backing off: fall back to the last good copy
  if (existsSync(file)) return { body: readFileSync(file, 'utf8'), cached: true, stale: true }
  return { error: 'rate limited' }
}

for (const f of FEEDS) {
  try {
    const res = await fetchFeed(f)
    if (res.error) { health.push(`${f.name}: ${res.error}`); continue }
    await sleep(res.cached ? 0 : 700)
    const items = parseFeed(res.body)
    health.push(`${f.name}: ${items.length} items${res.stale ? ' (cached — host rate-limited us)' : res.cached ? ' (cached)' : ''}`)
    for (const it of items) {
      if (!it.title || !it.link) continue
      if (it.date && it.date.getTime() < cutoff) continue
      // calendars publish months ahead; this app is about the next week or two
      if (it.date && it.date.getTime() > Date.now() + 14 * 864e5) continue
      const key = it.link.split('?')[0]
      if (seen.has(key)) continue
      const hay = `${it.title} ${it.summary}`
      if (NOISE.test(hay) || ASKING.test(it.title.trim())) continue
      if (/\b(cancell?ed|postponed|rescheduled)\b/i.test(it.title)) continue
      if (f.eventFeed && ACADEMIC.test(hay)) continue
      if (/\?\s*$/.test(it.title.trim()) && !FLAGSHIP.test(it.title)) continue
      // campus calendars title-stamp the date ("Sep 9, 2026: …"); anything far
      // out is a diary entry, not something to go to this week
      const titleDate = it.title.match(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i)
      if (titleDate) {
        const when = Date.parse(titleDate[1])
        if (!Number.isNaN(when) && when > Date.now() + 14 * 864e5) continue
      }
      const flagship = FLAGSHIP.test(it.title)
      const strong = STRONG.test(f.headlineOnly ? it.title : hay)
      const weak = WEAK.test(hay)
      const dated = DATEISH.test(hay)
      // an event needs a name for itself — unless the whole feed is a calendar
      if (!flagship && !strong && !f.eventFeed) continue
      const hits = (strong ? 3 : 0) + (weak ? 1 : 0) + (dated ? 2 : 0) + (flagship ? 12 : 0) + (f.eventFeed ? 2 : 0)

      // does it name somewhere we already map?
      const spotHit = SPOTS.find((s) => new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay))
      const venueHit = VENUES.find((v) => new RegExp(`\\b${v.venue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay))
      const spot = spotHit || (venueHit ? SPOTS.find((s) => s.id === venueHit.id) : null)

      if (titlesSeen.has(key)) continue
      titlesSeen.add(key)
      const titleKey = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70)
      if (titlesSeen.has(titleKey)) continue
      titlesSeen.add(titleKey)
      found.push({
        source: f.name,
        title: it.title,
        link: it.link,
        date: it.date ? it.date.toISOString().slice(0, 10) : '',
        summary: it.summary.slice(0, 180),
        spotId: spot?.id || null,
        spotName: spot?.name || null,
        via: venueHit && !spotHit ? venueHit.venue : null,
        flagship,
        score: f.weight + hits + (spot ? 4 : 0),
      })
      seenAll.add(key)
    }
  } catch (e) {
    health.push(`${f.name}: ERROR ${e.message.slice(0, 50)}`)
  }
}

// cap each feed's contribution so a 1,300-item university calendar cannot
// crowd out a neighbourhood blog with one good tip
const PER_FEED = 8
const perFeed = {}
const capped = []
for (const item of found.sort((a, b) => b.score - a.score || (b.date > a.date ? 1 : -1))) {
  perFeed[item.source] = (perFeed[item.source] || 0) + 1
  if (perFeed[item.source] <= PER_FEED) capped.push(item)
}
found.length = 0
found.push(...capped)
writeFileSync(SEEN, JSON.stringify([...seenAll].slice(-4000)))

// --- digest -----------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
const flagships = found.filter((f) => f.flagship)
const mapped = found.filter((f) => !f.flagship && f.spotId)
const unmapped = found.filter((f) => !f.flagship && !f.spotId)
const lines = []
lines.push(`# out. — event radar, ${today}`)
lines.push('')
lines.push(`${found.length} new candidate${found.length === 1 ? '' : 's'} across ${FEEDS.length} feeds (last ${DAYS} days).`)
lines.push('Nothing here is on the map yet — this is a review queue.')
lines.push('')
if (flagships.length) {
  lines.push(`## Read these first (${flagships.length})`)
  lines.push('')
  for (const f of flagships) {
    lines.push(`- **${f.title}**`)
    lines.push(`  ${f.date ? f.date + ' · ' : ''}${f.source} · ${f.link}`)
  }
  lines.push('')
}
if (mapped.length) {
  lines.push(`## At places we already map (${mapped.length})`)
  lines.push('')
  for (const f of mapped) {
    lines.push(`- **${f.spotName}** — ${f.title}${f.via ? `  _(matched on "${f.via}")_` : ''}`)
    lines.push(`  ${f.date ? f.date + ' · ' : ''}${f.source} · ${f.link}`)
  }
  lines.push('')
}
if (unmapped.length) {
  lines.push(`## Elsewhere in the city (${unmapped.length})`)
  lines.push('')
  for (const f of unmapped.slice(0, 40)) {
    lines.push(`- ${f.title}`)
    lines.push(`  ${f.date ? f.date + ' · ' : ''}${f.source} · ${f.link}`)
  }
  lines.push('')
}
lines.push('## Check by hand')
lines.push('')
for (const [name, why] of MANUAL) lines.push(`- ${name} — ${why}`)
lines.push('')
lines.push('## Feed health')
lines.push('')
for (const h of health) lines.push(`- ${h}`)

const out = `${DIR}/digest-${today}.md`
writeFileSync(out, lines.join('\n') + '\n')
console.log(lines.join('\n'))
console.log(`\nwritten to ${out}`)
