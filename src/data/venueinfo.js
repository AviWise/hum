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
export const VENUE_EVENTS = [
  { venue: 'Echostage', date: '2026-08-28', time: '22:00', title: 'Alyssa Jolee, Cera Khin, TRYM, Yosuf' },
  { venue: 'Echostage', date: '2026-08-29', time: '22:00', title: 'William Black — The Shadow Realm Tour' },
  { venue: 'Echostage', date: '2026-09-03', time: '20:00', title: 'LUCKI — Bad Influence Tour' },
  { venue: 'Echostage', date: '2026-09-04', time: '22:00', title: 'Unreal North America Tour — 999999999, Adrián Mills' },
  { venue: 'Echostage', date: '2026-09-05', time: '18:30', title: 'HUGEL (early show)' },
  { venue: 'Echostage', date: '2026-09-05', time: '23:30', title: 'Chris Stussy (late show)' },
  { venue: 'Echostage', date: '2026-09-06', time: '21:00', title: 'Odd Mob with DEVAULT, airrica' },
  { venue: 'Echostage', date: '2026-09-11', time: '22:00', title: 'Bad Boombox' },

  { venue: 'Flash', date: '2026-08-29', time: '22:00', title: 'Oliver Koletzki b2b Frida Darko' },
  { venue: 'Flash', date: '2026-08-30', time: '16:00', title: 'Sunday Love: Jamie 3:26, Sal Negro, Gianni V' },
  { venue: 'Flash', date: '2026-09-04', time: '22:00', title: 'fumi with JADE CAO, Micfreak' },
  { venue: 'Flash', date: '2026-09-05', time: '22:00', title: 'DJ Three & Öona Dahl (open to close)' },
  { venue: 'Flash', date: '2026-09-06', time: '16:00', title: 'Sunday Love: Eduardo de la Calle, dimneonsum' },
  { venue: 'Flash', date: '2026-09-11', time: '22:00', title: 'Anastazja, Apollo Dust' },

  { venue: '9:30 Club', date: '2026-08-28', time: '18:00', title: 'Earlybirds Club' },
  { venue: '9:30 Club', date: '2026-08-29', time: '18:00', title: 'Earlybirds Club (sold out)' },
  { venue: '9:30 Club', date: '2026-08-31', time: '18:30', title: 'Quicksand & Bane with Soul Blind' },
  { venue: '9:30 Club', date: '2026-09-01', time: '19:00', title: 'MIKE D 5D (sold out)' },
  // 2026-09-03 Trouble Funk omitted — the venue lists it as CANCELED
  { venue: '9:30 Club', date: '2026-09-04', time: '21:00', title: 'Emo Night Brooklyn' },
  { venue: '9:30 Club', date: '2026-09-05', time: '21:00', title: 'Gimme Gimme Disco' },
  { venue: '9:30 Club', date: '2026-09-07', time: '19:00', title: 'Channel Tres — The Enigma Tour' },
  { venue: '9:30 Club', date: '2026-09-08', time: '19:00', title: 'Peter Hook & The Light' },
  { venue: '9:30 Club', date: '2026-09-10', time: '19:00', title: 'Bella Kay: The Reckless Tour' },
  { venue: '9:30 Club', date: '2026-09-11', time: '18:00', title: 'Melanie C World Tour' },

  { venue: 'The Atlantis', date: '2026-08-29', time: '19:00', title: 'Flashband — Warped Tour Showcase' },
  { venue: 'The Atlantis', date: '2026-08-30', time: '18:30', title: 'Meltt' },
  { venue: 'The Atlantis', date: '2026-08-31', time: '18:30', title: 'Solya' },
  { venue: 'The Atlantis', date: '2026-09-01', time: '18:30', title: 'Patti Smith' },
  { venue: 'The Atlantis', date: '2026-09-03', time: '18:30', title: 'Fox N Vead' },
  { venue: 'The Atlantis', date: '2026-09-09', time: '18:30', title: 'DeVotchKa — Little Miss Sunshine tribute' },
  { venue: 'The Atlantis', date: '2026-09-12', time: '19:00', title: 'Nate Sib' },

  { venue: 'Black Cat', date: '2026-08-28', time: '20:00', title: 'Super Art Fight' },
  { venue: 'Black Cat', date: '2026-09-04', time: '19:00', title: 'Nino Paid' },
  { venue: 'Black Cat', date: '2026-09-11', time: '20:00', title: 'Rastapé (live forró)' },

  { venue: 'Songbyrd', date: '2026-08-31', time: '20:00', title: 'Parrotfish' },
  { venue: 'Songbyrd', date: '2026-09-02', time: '20:00', title: 'Emarosa' },

  { venue: 'Decades', date: '2026-08-29', time: '16:00', title: 'FUN: Rooftop Day Party — Patron open bar 4–5pm' },
  { venue: 'Decades', date: '2026-08-30', time: '16:00', title: 'No Ceilings: Decades Sundays Day Party' },
]

const DAY_MS = 86400000
const dateKey = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// What is on at this spot's venues today (and, after 6pm, tomorrow's early
// shows are not much use, so today only).
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
