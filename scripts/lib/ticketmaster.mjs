// Ticketmaster Discovery API adapter.
//
// One structured feed instead of five bespoke scrapers: exact dates, times and
// venue names, so nothing has to be parsed out of a slug or a rendered page.
//
//   https://app.ticketmaster.com/discovery/v2/events.json?apikey=...
//
// Auth is a plain `apikey` query parameter. Documented limits are 5,000 calls
// per day and 5 requests per second — far more than a weekly job needs, but the
// per-second cap is why paging is spaced out below rather than fired at once.
//
// CONTRACT, and why it matters: every failure path here THROWS rather than
// returning an empty array. A source that quietly returns nothing would let the
// refresh job replace a good calendar with an empty one, and the app would stop
// showing "On tonight" with nobody the wiser.
import { readFileSync } from 'node:fs'

const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'
const VENUES = 'https://app.ticketmaster.com/discovery/v2/venues.json'
// 5 req/sec is the documented cap; 250ms between pages keeps us at 4.
const PACE_MS = 250
const pace = () => new Promise((r) => setTimeout(r, PACE_MS))

export function readKey() {
  if (process.env.TICKETMASTER_KEY) return process.env.TICKETMASTER_KEY.trim()
  try {
    return readFileSync('.env', 'utf8').match(/^TICKETMASTER_KEY=(\S+)/m)?.[1] ?? null
  } catch { return null }
}

// geoPoint takes a geohash; the `latlong` parameter is deprecated. Small
// encoder rather than a dependency for twelve lines of arithmetic.
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz'
export function geohash(lat, lon, precision = 5) {
  const latR = [-90, 90], lonR = [-180, 180]
  let hash = '', bit = 0, ch = 0, even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lonR[0] + lonR[1]) / 2
      if (lon > mid) { ch = (ch << 1) + 1; lonR[0] = mid } else { ch = ch << 1; lonR[1] = mid }
    } else {
      const mid = (latR[0] + latR[1]) / 2
      if (lat > mid) { ch = (ch << 1) + 1; latR[0] = mid } else { ch = ch << 1; latR[1] = mid }
    }
    even = !even
    if (++bit === 5) { hash += B32[ch]; bit = 0; ch = 0 }
  }
  return hash
}

// Pick the best artwork for a card.
//
// `fallback: true` images are Ticketmaster's generic category placeholders —
// the same stock picture on dozens of events — so they are skipped entirely.
// 74% of events at our venues carry real art; the rest fall back to the spot's
// own photo, which the page already does for posts.
//
// Sizes run from 100px to 9704px. Anything past ~1300 is a waste on a phone.
const pickImage = (images = []) => {
  const real = images.filter((i) => i.fallback === false && i.url && i.width)
  if (!real.length) return null
  const wide = real.filter((i) => i.ratio === '16_9' || i.ratio === '3_2' || !i.ratio)
  const pool = wide.length ? wide : real
  // closest to 800px wide without going under 500 if we can help it
  const scored = pool.map((i) => ({ i, d: Math.abs(i.width - 800) + (i.width < 500 ? 600 : 0) }))
  return scored.sort((a, b) => a.d - b.d)[0].i.url
}

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, '').replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Names Ticketmaster uses that must NEVER match one of ours, however well the
// strings line up. Verified by --map-venues against the live index.
const BLOCKED = new Set([
  // Culture is the Ivy City warehouse club. Culture House DC is the painted
  // church in Southwest — a different building entirely, and hum already lists
  // it separately as "Culture House (nearby)" under Rubell.
  'culture house dc',
  // Not our Trade, which is the Logan Circle queer bar.
  'ronald reagan building and international trade center',
  // Not the private clubs of similar name.
  'george washington university',
  'georgetown university',
])

// Ticketmaster's venue names do not always match ours.
const ALIASES = {
  '930 club': '9:30 Club',
  'the atlantis': 'The Atlantis',
  'fillmore silver spring': 'The Fillmore Silver Spring',
  'the fillmore silver spring': 'The Fillmore Silver Spring',
  'songbyrd music house': 'Songbyrd',
  'songbyrd music house and record cafe': 'Songbyrd',
  // "Flash" is five characters, and the substring fallback below requires more
  // than five to avoid matching everything. Short names need explicit aliases.
  'flash dc': 'Flash',
  // Ticketmaster's spellings for rooms hum names differently.
  'nationals park': 'Nats Park',
  'improv comedy club dc': 'DC Improv',
  'howard theatre dc': 'Howard Theatre',
  'room 808': 'Room 808 comedy',
  'dc9': 'DC9 Nightclub',
  'dc9 nightclub': 'DC9 Nightclub',
  // One building, two names on the door: comedy upstairs, the beer hall below.
  // Shows belong to the comedy room.
  'dc comedy loft and bier baron tavern': 'The Comedy Loft of DC',
  'culture house dc': null,
}

/** Resolve a Ticketmaster venue name to one of ours, or null to skip it. */
export function matchVenue(tmName, known) {
  const n = norm(tmName)
  if (BLOCKED.has(n)) return null
  if (ALIASES[n]) return ALIASES[n]
  for (const k of known) if (norm(k) === n) return k
  for (const k of known) { const kn = norm(k); if (kn.length > 5 && (n.includes(kn) || kn.includes(n))) return k }
  return null
}

/** @returns {Promise<Array<{venue,date,time,title,source}>>} — throws on any failure. */
export async function fetchEvents({ key, lat = 38.9072, lon = -77.0369, radiusMiles = 25,
                                    fromISO, toISO, knownVenues = [], maxPages = 5, fetchImpl = fetch }) {
  if (!key) throw new Error('ticketmaster: no API key')
  if (!knownVenues.length) throw new Error('ticketmaster: no known venues to match against')

  const out = []
  let matchedAny = false
  for (let page = 0; page < maxPages; page++) {
    const url = `${BASE}?${new URLSearchParams({
      apikey: key,
      geoPoint: geohash(lat, lon, 5),
      radius: String(radiusMiles),
      unit: 'miles',
      startDateTime: fromISO,
      endDateTime: toISO,
      size: '100',
      page: String(page),
      sort: 'date,asc',
    })}`
    const r = await fetchImpl(url)
    if (r.status === 401 || r.status === 403) throw new Error(`ticketmaster: key rejected (HTTP ${r.status})`)
    if (r.status === 429) throw new Error('ticketmaster: rate limited (HTTP 429)')
    if (!r.ok) throw new Error(`ticketmaster: HTTP ${r.status}`)
    const j = await r.json()
    const events = j?._embedded?.events ?? []
    if (!events.length) break

    for (const e of events) {
      const tmVenue = e?._embedded?.venues?.[0]?.name
      if (!tmVenue) continue
      const venue = matchVenue(tmVenue, knownVenues)
      if (!venue) continue
      matchedAny = true
      const date = e?.dates?.start?.localDate
      if (!date) continue
      const time = e?.dates?.start?.localTime
      // Cancelled shows come back in the feed like any other. Importing them
      // is how a student ends up outside a dark room — which already happened
      // once by hand, with the 09-03 Trouble Funk show at 9:30 Club.
      const status = e?.dates?.status?.code
      if (status === 'cancelled' || status === 'canceled') continue

      // priceRanges is present on about a third of events. Cheapest standard
      // price is the number that decides whether a student goes.
      const pr = (e.priceRanges || []).find((r) => r.type === 'standard') || (e.priceRanges || [])[0]
      const price = pr && Number.isFinite(pr.min) ? { min: Math.round(pr.min), max: Math.round(pr.max ?? pr.min) } : null

      const img = pickImage(e.images)
      out.push({
        venue,
        date,
        time: time ? String(time).slice(0, 5) : '20:00',  // doors unknown -> sane evening default
        title: String(e.name || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        ...(img ? { img } : {}),
        ...(e.url ? { url: e.url } : {}),
        ...(price ? { price } : {}),
        // NOT recorded as "sold out": offsale means sales are closed, which can
        // equally be sales that have not opened yet. Claiming sold out from it
        // would be inventing a fact the feed does not carry.
        ...(status && status !== 'onsale' ? { status } : {}),
        source: 'ticketmaster',
      })
    }
    if (page + 1 >= (j?.page?.totalPages ?? 1)) break
    await pace()
  }

  // Reaching the API, getting 200s and matching nothing is far more likely to
  // be a broken venue-name map than a genuinely empty fortnight in DC.
  if (!matchedAny) throw new Error('ticketmaster: reached the API but matched none of our venues — check ALIASES')

  const seen = new Set()
  return out.filter((e) => { const k = `${e.venue}|${e.date}|${e.title}`; if (seen.has(k)) return false; seen.add(k); return true })
}

/**
 * Look up what Ticketmaster actually calls our venues.
 *
 * The ALIASES map above is my guess at their naming. This checks it against
 * reality: for each of our venue names it searches their venue index and
 * reports the id and the exact name they use, so the map can be corrected from
 * data rather than from assumption. Needs a key, which is why it is a separate
 * command rather than something the refresh job relies on.
 *
 * @returns {Promise<Array<{ours,found:Array<{id,name,city}>}>>}
 */
export async function lookupVenues({ key, names, lat = 38.9072, lon = -77.0369,
                                     radiusMiles = 30, fetchImpl = fetch }) {
  if (!key) throw new Error('ticketmaster: no API key')
  const out = []
  for (const ours of names) {
    // Constrained by geoPoint + radius, NOT by stateCode.
    //
    // stateCode would have missed Clarendon (VA) and Silver Spring (MD).
    // Unconstrained was worse: a keyword search returned "Shenanigans Irish Pub
    // and Grill" in Brownsville, Texas and "Cassette Number Nine" in Auckland,
    // and the name resolved cleanly enough that both were reported as fine. A
    // venue matcher that ignores geography is a wrong-answer machine.
    const qs = {
      apikey: key, keyword: ours, size: '5',
      geoPoint: geohash(lat, lon, 5), radius: String(radiusMiles), unit: 'miles',
    }
    const url = `${VENUES}?${new URLSearchParams(qs)}`
    const r = await fetchImpl(url)
    if (r.status === 401 || r.status === 403) throw new Error(`ticketmaster: key rejected (HTTP ${r.status})`)
    if (!r.ok) throw new Error(`ticketmaster: venue lookup HTTP ${r.status}`)
    const j = await r.json()
    const found = (j?._embedded?.venues ?? []).map((v) => ({
      id: v.id, name: v.name, city: v?.city?.name ?? '', state: v?.state?.stateCode ?? '',
    }))
    out.push({ ours, found })
    await pace()
  }
  return out
}
