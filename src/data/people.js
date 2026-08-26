// Demo people. Like the seeded calendar, these are sample profiles so the
// map feels inhabited before real accounts fill it in — they author the
// seeded posts, so their stories are whatever's live on the board today.
import { SPOTS, CATEGORIES } from './spots.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

// hue from username so every avatar gets a stable, warm identity color
export function avatarHue(username) {
  let h = 0
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export const TEST_PROFILES = {
  'out.demo.maya': {
    username: 'out.demo.maya', name: 'Maya Diallo', demo: true,
    line: 'will walk 40 minutes for a good bench',
    history: ['kogod', 'phillips', 'hirshhorn', 'ngaeast', 'meridian', 'gtwaterfront', 'tidalbasin', 'folger'],
  },
  'out.demo.jordan': {
    username: 'out.demo.jordan', name: 'Jordan Grant', demo: true,
    line: 'somebody has to organize the group chat',
    history: ['admo', 'fourteenth', 'hstreet', 'shaw', 'clubrow', 'navyyard', 'derbylymans'],
  },
  'out.demo.sofia': {
    username: 'out.demo.sofia', name: 'Sofía Reyes', demo: true,
    line: 'front rail or nothing',
    history: ['ustreet', 'anacostia', 'dc9', 'bluesalley', 'songbyrd', 'comet', 'sixthandi', 'unionstation'],
  },
  'out.demo.dev': {
    username: 'out.demo.dev', name: 'Dev Patel', demo: true,
    line: 'laptop, cortado, repeat',
    history: ['loc', 'mlk', 'tryst', 'bigbear', 'lacolombe', 'peregrine', 'unionmarket', 'tapori', 'wiseguy'],
  },
  'out.demo.nia': {
    username: 'out.demo.nia', name: 'Nia Washington', demo: true,
    line: 'howard made me, the city keeps me',
    history: ['ustreet', 'flash', 'ivycity', 'bliss', 'banneker', 'sankofa', 'parkview'],
  },
  'out.demo.tommy': {
    username: 'out.demo.tommy', name: 'Tommy O’Connell', demo: true,
    line: 'tour guide voice: and on your left…',
    history: ['georgetown', 'exorcist', 'lincoln', 'mall', 'capitol', 'unionstation', 'clocktower', 'cathedral', 'wiseys'],
  },
  'out.demo.lena': {
    username: 'out.demo.lena', name: 'Lena Kim', demo: true,
    line: 'if it has a back room, i’ve found it',
    history: ['dupontund', 'omansion', 'catacombs', 'chbooks', 'byrdland', 'planetword', 'suns', 'eaton'],
  },
  'out.demo.marcus': {
    username: 'out.demo.marcus', name: 'Marcus James', demo: true,
    line: 'sunset scout, blanket provider',
    history: ['meridian', 'gravelly', 'iwojima', 'hains', 'roosevelt', 'kingman', 'rockcreek', 'gtwaterfront', 'fortreno'],
  },
}

// who authors each seeded post — so bylines lead somewhere real
const AUTHORS = {
  e1: 'out.demo.sofia', e2: 'out.demo.jordan', e3: 'out.demo.jordan', e4: 'out.demo.marcus', e5: 'out.demo.dev',
  e6: 'out.demo.tommy', e7: 'out.demo.sofia', e8: 'out.demo.jordan', e9: 'out.demo.marcus', e10: 'out.demo.maya',
  e11: 'out.demo.lena', e12: 'out.demo.dev', e13: 'out.demo.jordan', e14: 'out.demo.maya', e15: 'out.demo.sofia',
  e16: 'out.demo.lena', e17: 'out.demo.nia', e18: 'out.demo.sofia', e19: 'out.demo.jordan', e20: 'out.demo.lena',
  e21: 'out.demo.nia', e22: 'out.demo.nia', e23: 'out.demo.marcus', e24: 'out.demo.lena', e25: 'out.demo.dev',
  e26: 'out.demo.nia', e27: 'out.demo.nia', e28: 'out.demo.tommy', e29: 'out.demo.sofia', e30: 'out.demo.maya',
  x1: 'out.demo.marcus',
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
