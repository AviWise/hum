// Demo people. Like the seeded calendar, these are sample profiles so the
// map feels inhabited before real accounts fill it in — they author the
// seeded posts, so their stories are whatever's live on the board today.
import { SPOTS, CATEGORIES } from './spots.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

// The letter on an avatar should mean something: demo handles are namespaced
// `hum.demo.marcus`, so take the part that identifies the person, not the prefix.
export function avatarInitial(username = '?') {
  const core = username.replace(/^out\.demo\./, '')
  return (core.match(/[a-z0-9]/i)?.[0] || '?').toUpperCase()
}

// hue from username so every avatar gets a stable, warm identity color
export function avatarHue(username) {
  let h = 0
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export const TEST_PROFILES = {
  'hum.demo.maya': {
    username: 'hum.demo.maya', name: 'Maya Diallo', demo: true,
    line: 'will walk 40 minutes for a good bench',
    history: ['kogod', 'phillips', 'hirshhorn', 'ngaeast', 'meridian', 'gtwaterfront', 'tidalbasin', 'folger'],
  },
  'hum.demo.jordan': {
    username: 'hum.demo.jordan', name: 'Jordan Grant', demo: true,
    line: 'somebody has to organize the group chat',
    history: ['admo', 'fourteenth', 'hstreet', 'shaw', 'clubrow', 'navyyard', 'derbylymans'],
  },
  'hum.demo.sofia': {
    username: 'hum.demo.sofia', name: 'Sofía Reyes', demo: true,
    line: 'front rail or nothing',
    history: ['ustreet', 'anacostia', 'dc9', 'bluesalley', 'songbyrd', 'comet', 'sixthandi', 'unionstation'],
  },
  'hum.demo.dev': {
    username: 'hum.demo.dev', name: 'Dev Patel', demo: true,
    line: 'laptop, cortado, repeat',
    history: ['loc', 'mlk', 'tryst', 'bigbear', 'lacolombe', 'peregrine', 'unionmarket', 'tapori', 'wiseguy'],
  },
  'hum.demo.nia': {
    username: 'hum.demo.nia', name: 'Nia Washington', demo: true,
    line: 'howard made me, the city keeps me',
    history: ['ustreet', 'flash', 'ivycity', 'bliss', 'banneker', 'sankofa', 'parkview'],
  },
  'hum.demo.tommy': {
    username: 'hum.demo.tommy', name: 'Tommy O’Connell', demo: true,
    line: 'tour guide voice: and on your left…',
    history: ['georgetown', 'exorcist', 'lincoln', 'mall', 'capitol', 'unionstation', 'clocktower', 'cathedral', 'wiseys'],
  },
  'hum.demo.lena': {
    username: 'hum.demo.lena', name: 'Lena Kim', demo: true,
    line: 'if it has a back room, i’ve found it',
    history: ['dupontund', 'omansion', 'catacombs', 'chbooks', 'byrdland', 'planetword', 'suns', 'eaton'],
  },
  'hum.demo.marcus': {
    username: 'hum.demo.marcus', name: 'Marcus James', demo: true,
    line: 'sunset scout, blanket provider',
    history: ['meridian', 'gravelly', 'iwojima', 'hains', 'roosevelt', 'kingman', 'rockcreek', 'gtwaterfront', 'fortreno'],
  },
}

// who authors each seeded post — so bylines lead somewhere real
const AUTHORS = {
  e1: 'hum.demo.sofia', e2: 'hum.demo.jordan', e3: 'hum.demo.jordan', e4: 'hum.demo.marcus', e5: 'hum.demo.dev',
  e6: 'hum.demo.tommy', e7: 'hum.demo.sofia', e8: 'hum.demo.jordan', e9: 'hum.demo.marcus', e10: 'hum.demo.maya',
  e11: 'hum.demo.lena', e12: 'hum.demo.dev', e13: 'hum.demo.jordan', e14: 'hum.demo.maya', e15: 'hum.demo.sofia',
  e16: 'hum.demo.lena', e17: 'hum.demo.nia', e18: 'hum.demo.sofia', e19: 'hum.demo.jordan', e20: 'hum.demo.lena',
  e21: 'hum.demo.nia', e22: 'hum.demo.nia', e23: 'hum.demo.marcus', e24: 'hum.demo.lena', e25: 'hum.demo.dev',
  e26: 'hum.demo.nia', e27: 'hum.demo.nia', e28: 'hum.demo.tommy', e29: 'hum.demo.sofia', e30: 'hum.demo.maya',
  x1: 'hum.demo.marcus',
}

export function attachAuthor(ev) {
  const u = AUTHORS[ev.id]
  return u ? { ...ev, by: u } : ev
}

export function personFor(username) {
  return TEST_PROFILES[username] || null
}

// badges are earned, not chosen: three posts in a lane and it's yours
const BADGE_DEFS = [
  { cat: 'culture', label: 'Museum Rat', need: 3 },
  { cat: 'bar', label: 'Barfly', need: 3 },
  { cat: 'club', label: 'Night Shift', need: 3 },
  { cat: 'music', label: 'Front Row', need: 3 },
  { cat: 'eats', label: 'Taste Tester', need: 3 },
  { cat: 'study', label: 'Library Ghost', need: 3 },
  { cat: 'outside', label: 'Golden Hour', need: 3 },
  { cat: 'landmark', label: 'Tourist at Home', need: 3 },
  { cat: 'niche', label: 'Deep Cuts', need: 3 },
]

export function computeBadges(spotIds) {
  const counts = {}
  for (const id of spotIds) {
    const cat = bySpot[id]?.cat
    if (cat) counts[cat] = (counts[cat] || 0) + 1
  }
  const badges = BADGE_DEFS
    .filter((b) => (counts[b.cat] || 0) >= b.need)
    .map((b) => ({ ...b, color: CATEGORIES[b.cat].color, deep: CATEGORIES[b.cat].deep }))
  if (spotIds.length >= 10) badges.push({ cat: null, label: 'Regular', color: '#5C5248', deep: '#443C33' })
  return badges
}

export function profileStats(spotIds) {
  return { posts: spotIds.length, spots: new Set(spotIds).size }
}
