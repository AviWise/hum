import GENERATED_EVENTS from './venue-events.json' with { type: 'json' }

// Per-VENUE opening hours, recurring nights, and dated events.
//
// hum's spots are AREAS — "Adams Morgan", "Club Row" — and everything here
// belongs to a venue inside one. Rather than turn `spot.venues` from strings
// into objects (which every consumer would have to learn), this is a lookup
// beside it, keyed by the same venue string. Additive: nothing that reads
// spot.venues changes.
//
// PROVENANCE. Supplied by Avi 2026-08-28. Spot-checked against the venues' own
// calendars before it was written in: 9:30 Club and Echostage both matched on
// date, artist and door time. Two corrections came out of that check — the
// 2026-09-03 Trouble Funk show at 9:30 Club is CANCELED per the venue and is
// omitted below, and Echostage's own listing for 09-04 names Cara Elizabeth
// where the source said WINSON. Everything else is as supplied and is NOT
// independently verified; hours in particular drift.
//
// `themes` are recurring and do not expire. `EVENTS` are dated and simply stop
// rendering once their date passes, which is the intended failure mode: the
// list empties rather than going stale.

export const VENUE_INFO = {
  // ---- electronic & mega-clubs ----
  'Echostage': { spot: 'ivycity', hours: 'Event nights, typically Thu–Sat 9pm–3am', themes: ['Touring EDM headliners', 'Festival-scale production'] },
  'Soundcheck': { spot: 'park14', hours: 'Thu 10pm–2am · Fri–Sat 10pm–3am', themes: ['Soundcheck Thursdays — local bass & tech house', 'Free entry before 11pm with RSVP on select shows'] },
  'Flash': { spot: 'flash', hours: 'Wed–Thu 8pm–2am · Fri–Sat 10pm–4am · Sun 4pm–2am', themes: ['Sunday Love — sound bath into daytime house', 'Flash Bar Sessions — free entry cutoffs'] },
  'Culture': { spot: 'ivycity', hours: 'Fri–Sat 10pm–3:30am', themes: ['Warehouse dance parties', 'Arts pop-ups and indie label nights'] },
  'Karma DC Live Music Venue': { spot: 'ivycity', hours: 'Event-driven, typically Fri–Sat 10pm–4am', themes: ['Afrobeats & amapiano floors', 'Caribbean sound clashes'] },

  // ---- multi-level & high-energy ----
  'Decades': { spot: 'clubrow', hours: 'Thu 10pm–2am · Fri 9pm–3am · Sat 4pm–3am · Sun 4pm–2am', themes: ['Thursdays — college night, free RSVP, open bar 10–11pm', 'Sat & Sun rooftop day parties 4–9pm'] },
  'The Park at Fourteenth': { spot: 'park14', hours: 'Thu 5pm–2am · Fri 5pm–3am · Sat 8pm–3am · Sun 11am–8pm', themes: ['Park After Work — Thu/Fri 5–7pm, jerk chicken buffet', 'Sunday bottomless brunch'] },
  'Abigail': { spot: 'clubrow', hours: 'Thu–Sun 10pm–3am', themes: ['Abigail Thursdays — industry night', 'Friday R&B and hip-hop'] },
  'Mayflower Club': { spot: 'clubrow', hours: 'Wed 10pm–2am · Thu 9pm–2am · Fri–Sat 9pm–3am · Sun 4pm–midnight', themes: ['Latin & international Thursdays', 'Zebbie’s Garden rooftop — open bar for early RSVP'] },
  "Zebbie's Garden": { spot: 'clubrow', hours: 'Wed 10pm–2am · Thu 9pm–2am · Fri–Sat 9pm–3am · Sun 4pm–midnight', themes: ['Neon rooftop garden', 'Sunday sunset sessions'] },
  'Rosebar Lounge': { spot: 'clubrow', hours: 'Mon–Thu 10pm–2am · Fri–Sat 10pm–3am · Sun 10pm–2am', themes: ['Rosebar Saturdays', 'Heated patio DJ sets'] },
  'Dirty Bar': { spot: 'clubrow', hours: 'Wed–Sat 10pm–3am', themes: ['Latin trap nights', 'Balcony patio buckets'] },
  'Heist': { spot: 'clubrow', hours: 'Thu–Sat 10pm–3am', themes: ['Subterranean speakeasy', 'Boutique bottle service'] },
  'The Living Room': { spot: 'park14', hours: 'Fri–Sat 10pm–3am', themes: ['VIP sofa sections', 'Open-format and EDM'] },
  'Twelve After Twelve': { spot: 'clubrow', hours: 'Wed–Thu 8pm–2am · Fri–Sat 8pm–3am · Sun 6pm–2am', themes: ['Free salsa & bachata classes midweek', 'Four rooms — Latin, deep house, open-format patio'] },
  'Saint Yves': { spot: 'park14', hours: 'Fri–Sat 10pm–3am', themes: ['Luxury bottle service', 'Open-format'] },
  'L8 Lounge': { spot: 'park14', hours: 'Wed–Sat 10pm–3am', themes: ['Latin fusion nights', 'Drink specials before midnight with guest list'] },
  'Club Elevate': { spot: 'park14', hours: 'Fri–Sat 10pm–3am', themes: ['Hip-hop and open-format floors'] },

  // ---- U Street, Shaw, Adams Morgan ----
  'El Techo': { spot: 'fourteenth', hours: 'Mon–Thu 5–11:30pm · Fri 5pm–2am · Sat 11am–2am · Sun 11am–11pm', themes: ['Rooftop Latin & reggaeton late nights', 'Weekend brunch fiestas'] },
  'Cloak & Dagger': { spot: 'ustreet', hours: 'Wed–Thu 7pm–2am · Fri–Sat 7pm–3am · Sun 8pm–2am', themes: ['Speakeasy downstairs', 'Upstairs dance floor — indie, hip-hop, 2000s'] },
  "Shenanigan's Irish Pub": { spot: 'admo', hours: 'Tue–Thu 6pm–2am · Fri–Sat 5pm–3am · Sun 6pm–2am', themes: ['Thursday college & trivia deals, $5 shots', 'Weekend DJ dance floor'] },
  "Madam's Organ": { spot: 'admo', hours: 'Daily 5pm–3am', themes: ['Live blues and soul downstairs', 'Karaoke upstairs', 'Tiki rooftop'] },
  'Club Timehri': { spot: 'admo', hours: 'Thu–Sat 9pm–3am', themes: ['Reggae, soca and dancehall', 'Drink specials before 11pm'] },
  'Bukom Cafe': { spot: 'admo', hours: 'Tue–Sun 5pm–3am', themes: ['West African kitchen into late highlife & Afrobeats'] },

  // ---- LGBTQ+ ----
  'Green Lantern': { spot: 'park14', hours: 'Mon–Thu 4pm–2am · Fri–Sat 4pm–3am · Sun 4pm–2am', themes: ['Thursdays — shirtless men drink free 10–11pm', 'Happy hour daily until 8pm'] },
  'Number Nine': { spot: 'fourteenth', hours: 'Mon–Thu 5pm–2am · Fri 4pm–3am · Sat 2pm–3am · Sun 2pm–2am', themes: ['2-for-1 happy hour daily until 9pm', 'Upstairs DJ Fri & Sat'] },
  'Trade': { spot: 'fourteenth', hours: 'Mon–Thu 5pm–2am · Fri 4pm–3am · Sat 2pm–3am · Sun 2pm–2am', themes: ['Huge Hour — jumbo cocktails daily until 10pm', 'Drag showcases', 'Patio parties'] },
  'Bunker': { spot: 'fourteenth', hours: 'Thu–Sat 10pm–4am', themes: ['Industrial techno and circuit house'] },
  'Dupont Italian Kitchen (DIK Bar)': { spot: 'dupont', hours: 'Daily 4pm–3am', themes: ['Upstairs karaoke several nights a week', 'Daily happy hour'] },
  'Pitchers / A League of Her Own': { spot: 'admo', hours: 'Wed–Thu 5pm–2am · Fri 4pm–3am · Sat 1pm–3am · Sun 1pm–2am', themes: ['Drag bingo', 'Game-day watch parties', 'ALOHO dance floor downstairs'] },

  // ---- live music ----
  '9:30 Club': { spot: 'ustreet', hours: 'Event nights, doors typically 6–7pm', themes: ['The cupcakes', 'Late-night themed dance parties'] },
  'The Atlantis': { spot: 'ustreet', hours: 'Event nights, doors typically 6:30pm', themes: ['450-cap replica of the original 9:30'] },
  'Black Cat': { spot: 'fourteenth', hours: 'Wed–Sun from 7pm on show nights', themes: ['Red Room bar', 'Vegan kitchen', 'Indie dance parties'] },
  'Songbyrd': { spot: 'songbyrd', hours: 'Tue–Sun 5pm–2am', themes: ['Record store cafe', 'Vinyl listening sessions'] },
  'Pie Shop': { spot: 'hstreet', hours: 'Wed–Sun 11am–2am · shows upstairs from 7:30pm', themes: ['Hot pies and local drafts', 'Punk and indie upstairs'] },

  // ---- comedy ----
  'The Comedy Loft of DC': { spot: 'phillips', hours: 'Thu–Sat, shows 7pm & 9:30pm', themes: ['Thursday open mics', '50+ taps at the Bier Baron below'] },
  'Bier Baron Tavern': { spot: 'phillips', hours: 'Thu–Sat, shows 7pm & 9:30pm upstairs', themes: ['50+ craft beers on tap'] },
  'Hotbed Comedy': { spot: 'admo', hours: 'Tue–Sun, shows 7pm, 8pm & 9:30pm', themes: ['Underground Comedy showcases', 'Free and low-cost RSVP shows'] },

  // ---- cigar & whiskey lounges ----
  // hum had no cigar or whiskey lounge anywhere before this; the two apparent
  // hits were Chicken + Whiskey (a restaurant) and Little Miss Whiskey's (a bar).
  "Shelly's Back Room": { spot: 'planetword', hours: 'Open late, to ~2am Fri–Sat', themes: ['Leather club chairs and heavy air filtration', 'Deep whiskey, bourbon and scotch list'] },
  'TG Cigar Lounge': { spot: 'carnegie', hours: 'Open late, to ~3am Sat', themes: ['Walk-in humidor', 'Full bar with whiskey pairings'] },
  'Casa de Montecristo': { spot: 'farragut', hours: 'Open late, to ~1am Sat', themes: ['Premium imported sticks', 'Craft cocktails and spirits'] },
  'Petworth Cigars': { spot: 'petworth', hours: 'Open late, to ~2am Sat', themes: ['Small neighbourhood lounge', 'Curated humidor'] },

  // ---- rooms hum already listed, but the event pipeline could not see ----
  //
  // Every one of these was already in a spot's venues[] array. The pipeline
  // matches against VENUE_INFO, not against spot.venues, so 159 events at
  // places hum already knows about were being discarded on every refresh.
  // Found by surveying ALL Ticketmaster events across the DMV rather than only
  // the ones matching venues we had already wired.
  'The Anthem': { spot: 'wharf', hours: 'Event nights', themes: ['6,000-cap hall on the Wharf'] },
  'Union Stage': { spot: 'wharf', hours: 'Event nights', themes: ['Basement room under the Wharf'] },
  'Pearl Street Warehouse': { spot: 'wharf', hours: 'Event nights', themes: ['Small room, diner attached'] },
  'Howard Theatre': { spot: 'shaw', hours: 'Event nights', themes: ['1910 room, restored — soul, hip-hop, gospel brunch'] },
  'Lincoln Theatre': { spot: 'ustreet', hours: 'Event nights', themes: ['U Street landmark, 1,200 seats'] },
  'Capital One Arena': { spot: 'gallery', kind: 'arena', hours: 'Event nights', themes: ['Caps, Wizards, and arena tours'] },
  'Audi Field': { spot: 'buzzard', kind: 'arena', hours: 'Match and event nights', themes: ['DC United'] },
  'Nats Park': { spot: 'navyyard', kind: 'arena', hours: 'Game nights', themes: ['Nationals baseball, and the concerts after'] },
  'Room 808 comedy': { spot: 'petworth', hours: 'Show nights', themes: ['Upshur Street comedy room'] },
  'Sixth & I': { spot: 'sixthandi', hours: 'Event nights', themes: ['Author talks, live podcasts, concerts in a synagogue'] },
  'DC Improv': { spot: 'dcimprov', hours: 'Wed–Sun, 7:30pm & 9:45pm', themes: ['Touring stand-up', 'Two-item minimum'] },

  // Downtown rooms hum did not have at all. The Sage alone is carrying 79
  // events in the next 60 days — the single biggest gap the survey found.
  'The Sage': { spot: 'park14', hours: 'Event nights', themes: ['1100 13th St NW'] },
  'The National Theatre': { spot: 'clocktower', hours: 'Event nights', themes: ['Pennsylvania Ave, touring Broadway'] },
  'Warner Theatre': { spot: 'clocktower', hours: 'Event nights', themes: ['1924 house on 13th Street'] },
  "Ford's Theatre": { spot: 'clocktower', hours: 'Event nights', themes: ['Working theatre and the Lincoln museum'] },
  'DAR Constitution Hall': { spot: 'peopleshouse', hours: 'Event nights', themes: ['3,700 seats by the White House'] },
  'Lisner Auditorium': { spot: 'foggybottom', hours: 'Event nights', themes: ['On the GW campus'] },

  // ---- reachable by Metro, outside DC ----
  'Clarendon Ballroom': { spot: 'clarendon', hours: 'Weekends, rooftop and ballroom', themes: ['Open-format and throwback nights', 'Multi-level with a rooftop'] },
  'The Renegade': { spot: 'clarendon', hours: 'Kitchen into late DJ sets', themes: ['Monday salsa', 'Weekend dance parties', 'Gastropub into nightclub'] },
  'The Fillmore Silver Spring': { spot: 'silverspring', hours: 'Event nights', themes: ['2,000-cap touring hall', 'Emo Night and 2000s bashes'] },
  'Cortez Cigars': { spot: 'silverspring', hours: 'Boutique lounge hours', themes: ['Family-owned, hand-rolled on site'] },
  'The Parkway Deli': { spot: 'silverspring', hours: 'Deli by day, listening room at night', themes: ['Acoustic and community sets'] },

  // ---- private & social ----
  'The Army and Navy Club': { spot: 'farragut', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
  'Metropolitan Club': { spot: 'farragut', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
  'University Club of Washington, DC': { spot: 'park14', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
  'Cosmos Club': { spot: 'phillips', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
  'The Georgetown Club': { spot: 'georgetown', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
  'National Press Club': { spot: 'planetword', hours: 'Members only · daily ~7am–11pm', themes: ['Members and guests only'] },
}

// Dated line-ups. These expire by date rather than being maintained: once the
// day passes they stop rendering, and the list simply empties.
// Dated line-ups, kept in venue-events.json so a scheduled job can rewrite them
// without touching hand-authored code. They expire by date rather than being
// maintained: once the day passes they stop rendering and the list empties.
export const VENUE_EVENTS = GENERATED_EVENTS

const DAY_MS = 86400000
const dateKey = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// What is on at this spot's venues today (and, after 6pm, tomorrow's early
// shows are not much use, so today only).
// A Nationals homestand and a DJ set are both "events" and are not the same
// thing to somebody deciding where to go. `kind: 'arena'` marks the rooms where
// the event IS the evening — Capital One Arena, Audi Field, Nats Park — and the
// interface keeps them in their own list rather than interleaved with nightlife.
//
// Deliberately only the three. The Anthem holds 6,000 and DAR Constitution Hall
// 3,700, but you go to those the way you go to a gig, not the way you go to a
// ball game.
export const isArena = (venue) => VENUE_INFO[venue]?.kind === 'arena'

// How many people a fixture actually puts on the street. Used to scale the heat
// a spot carries while a game or arena show is on.
const ARENA_CAPACITY = { 'Nats Park': 41000, 'Capital One Arena': 20000, 'Audi Field': 20000 }

/**
 * Extra heat a spot carries because of a fixture, 0 upward.
 *
 * Shaped like a game night rather than switched on for the day:
 *
 *   2h before   people arriving, bars filling      ramps 0.25 -> 0.7
 *   during      most of them are inside            0.7
 *   let-out     the street is at its fullest       1.0, decaying over 90 min
 *   otherwise   nothing
 *
 * The peak is at the final whistle, not at kickoff, because that is when 41,000
 * people are on the pavement at once — which is exactly what the demo post on
 * the Navy Yard sheet has always said: "game let out and the whole riverfront
 * turned into one bar".
 *
 * Scaled by capacity, so the Nationals move the map further than a soccer match.
 */
export function arenaHeat(spotId, now = Date.now()) {
  const HOUR = 3600000
  let best = 0
  for (const e of VENUE_EVENTS) {
    const info = VENUE_INFO[e.venue]
    if (info?.spot !== spotId || info.kind !== 'arena') continue
    const start = Date.parse(`${e.date}T${e.time}:00`)
    if (Number.isNaN(start)) continue
    const end = start + 3 * HOUR
    let phase = 0
    if (now >= start - 2 * HOUR && now < start) phase = 0.25 + 0.45 * ((now - (start - 2 * HOUR)) / (2 * HOUR))
    // The lower bound matters: without `now >= start` this branch is true for
    // every moment before any future fixture, and the spot glows permanently.
    else if (now >= start && now < end) phase = 0.7
    else if (now >= end && now < end + 1.5 * HOUR) phase = 1 - (now - end) / (1.5 * HOUR)
    else continue
    const scale = Math.min(40, (ARENA_CAPACITY[e.venue] ?? 20000) / 1000)
    best = Math.max(best, Math.round(phase * scale))
  }
  return best
}

export function eventsForSpot(spotId, now = Date.now()) {
  const key = dateKey(now)
  return VENUE_EVENTS
    .filter((e) => VENUE_INFO[e.venue]?.spot === spotId && e.date === key)
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function eventsOnDay(now = Date.now()) {
  const key = dateKey(now)
  return VENUE_EVENTS.filter((e) => e.date === key).sort((a, b) => a.time.localeCompare(b.time))
}

export function upcomingForSpot(spotId, now = Date.now(), days = 14) {
  const from = dateKey(now)
  const to = dateKey(now + days * DAY_MS)
  return VENUE_EVENTS
    .filter((e) => VENUE_INFO[e.venue]?.spot === spotId && e.date >= from && e.date <= to)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}

// Recurring nights that apply on this weekday, for the venues in a spot.
export function venuesForSpot(spotId) {
  return Object.entries(VENUE_INFO)
    .filter(([, v]) => v.spot === spotId)
    .map(([name, v]) => ({ name, ...v }))
}

// ---------------------------------------------------------------------------
// RECURRING PROGRAMMES
//
// A better shape than VENUE_EVENTS: these are rules, not dates, so they never
// go stale and never need a refresh. "Second Thursday, spring and fall" stays
// true next year.
//
// Anything without a real rule is deliberately NOT given one. Hirshhorn After
// Hours is "select dates", and Spit Dat and Beltway Poetry Slam move between
// venues — inventing a cadence for those would be exactly the kind of confident
// wrongness this app keeps having to unwind. They appear as notes instead.
//
// weekday: 0=Sun .. 6=Sat. `nth` counts that weekday within the month.
// `months` is 1-indexed and optional; absent means all year.
export const RECURRING = [
  { name: 'National Gallery Nights', spot: 'ngaeast', venue: 'National Gallery of Art — East Building',
    when: { nth: 2, weekday: 4 }, months: [3, 4, 5, 9, 10, 11], time: '18:00', until: '21:00',
    note: 'Free, but entry is a ticket lottery that opens about ten days ahead',
    blurb: 'Dance floor under the Calder, gallery talks, craft stations, pop-up bars' },

  { name: 'Phillips after 5', spot: 'phillips', venue: 'The Phillips Collection',
    when: { nth: 1, weekday: 4 }, time: '17:00', until: '20:30',
    note: '~$20, free for members — often sells out weeks ahead',
    blurb: 'Live music, spotlight talks, bites and cocktails from Bread Furst' },

  { name: 'NMWA Nights', spot: 'nmwa', venue: 'National Museum of Women in the Arts',
    when: { nth: 3, weekday: 3 }, time: '17:30', until: '20:00',
    note: 'Admission usually includes two drink tickets',
    blurb: 'Scavenger hunts, maker workshops, local female DJs, gallery tours' },

  { name: 'Wordplay Nights', spot: 'planetword', venue: 'Planet Word',
    when: { nth: 1, weekday: 3 }, time: '17:00', until: '20:00',
    blurb: 'Word puzzles, trivia, language karaoke, food from Immigrant Food' },

  // Busboys open mics — weekly, $5 online / $8 door, two-hour showcases
  { name: 'Open mic at Busboys and Poets', spot: 'fourteenth', venue: 'Busboys and Poets (14th & V)',
    when: { weekday: 2 }, time: '20:00', until: '22:00', note: '$5 online / $8 door',
    blurb: 'The flagship room — DMV spoken word, touring poets, open mic newcomers' },
  { name: 'Open mic at Busboys and Poets', spot: 'carnegie', venue: 'Busboys and Poets (450 K)',
    when: { weekday: 3 }, time: '20:00', until: '22:00', note: '$5 online / $8 door',
    blurb: 'Spoken word and acoustic sets, Mount Vernon Triangle' },
  { name: 'Open mic at Busboys and Poets', spot: 'brookland', venue: 'Busboys and Poets (Brookland)',
    when: { weekday: 5 }, time: '21:00', until: '23:00', note: '$5 online / $8 door',
    blurb: 'Friday night spoken word' },
  { name: 'Open mic at Busboys and Poets', spot: 'busboysana', venue: 'Busboys and Poets (Anacostia)',
    when: { weekday: 5 }, time: '21:00', until: '23:00', note: '$5 online / $8 door · select Fridays',
    blurb: 'Friday spoken word, select dates' },
]

// Programmes that genuinely have no fixed schedule. Shown as standing notes on
// the spot, never as "on tonight".
export const STANDING = [
  { spot: 'hirshhorn', name: 'Hirshhorn After Hours',
    blurb: 'Select dates — performance art, experimental DJs, projection mapping on the plaza. Ticketed through the Smithsonian Box Office.' },
]

const nthWeekdayOf = (d) => Math.floor((d.getDate() - 1) / 7) + 1

export function recurringForSpot(spotId, now = Date.now()) {
  const d = new Date(now)
  const wd = d.getDay(), month = d.getMonth() + 1, nth = nthWeekdayOf(d)
  return RECURRING.filter((r) => {
    if (r.spot !== spotId) return false
    if (r.when.weekday !== wd) return false
    if (r.months && !r.months.includes(month)) return false
    if (r.when.nth && r.when.nth !== nth) return false
    return true
  })
}

export function standingForSpot(spotId) {
  return STANDING.filter((r) => r.spot === spotId)
}
