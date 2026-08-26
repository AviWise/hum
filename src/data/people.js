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
  'maya.d': {
    username: 'maya.d', name: 'Maya Diallo', demo: true,
    line: 'will walk 40 minutes for a good bench',
    history: ['kogod', 'phillips', 'hirshhorn', 'ngaeast', 'meridian', 'gtwaterfront', 'tidalbasin', 'folger'],
  },
  jgrant: {
    username: 'jgrant', name: 'Jordan Grant', demo: true,
    line: 'somebody has to organize the group chat',
    history: ['admo', 'fourteenth', 'hstreet', 'shaw', 'clubrow', 'navyyard', 'derbylymans'],
  },
  'sofi.reyes': {
    username: 'sofi.reyes', name: 'Sofía Reyes', demo: true,
    line: 'front rail or nothing',
    history: ['ustreet', 'anacostia', 'dc9', 'bluesalley', 'songbyrd', 'comet', 'sixthandi', 'unionstation'],
  },
  dev_p: {
    username: 'dev_p', name: 'Dev Patel', demo: true,
    line: 'laptop, cortado, repeat',
    history: ['loc', 'mlk', 'tryst', 'bigbear', 'lacolombe', 'peregrine', 'unionmarket', 'tapori', 'wiseguy'],
  },
  'nia.w': {
    username: 'nia.w', name: 'Nia Washington', demo: true,
    line: 'howard made me, the city keeps me',
    history: ['ustreet', 'flash', 'ivycity', 'bliss', 'banneker', 'sankofa', 'parkview'],
  },
  'tommy.oc': {
    username: 'tommy.oc', name: 'Tommy O’Connell', demo: true,
    line: 'tour guide voice: and on your left…',
    history: ['georgetown', 'exorcist', 'lincoln', 'mall', 'capitol', 'unionstation', 'clocktower', 'cathedral', 'wiseys'],
  },
  'lena.k': {
    username: 'lena.k', name: 'Lena Kim', demo: true,
    line: 'if it has a back room, i’ve found it',
    history: ['dupontund', 'omansion', 'catacombs', 'chbooks', 'byrdland', 'planetword', 'suns', 'eaton'],
  },
  'marcus.j': {
    username: 'marcus.j', name: 'Marcus James', demo: true,
    line: 'sunset scout, blanket provider',
    history: ['meridian', 'gravelly', 'iwojima', 'hains', 'roosevelt', 'kingman', 'rockcreek', 'gtwaterfront', 'fortreno'],
  },
}

// who authors each seeded post — so bylines lead somewhere real
const AUTHORS = {
  e1: 'sofi.reyes', e2: 'jgrant', e3: 'jgrant', e4: 'marcus.j', e5: 'dev_p',
  e6: 'tommy.oc', e7: 'sofi.reyes', e8: 'jgrant', e9: 'marcus.j', e10: 'maya.d',
  e11: 'lena.k', e12: 'dev_p', e13: 'jgrant', e14: 'maya.d', e15: 'sofi.reyes',
  e16: 'lena.k', e17: 'nia.w', e18: 'sofi.reyes', e19: 'jgrant', e20: 'lena.k',
  e21: 'nia.w', e22: 'nia.w', e23: 'marcus.j', e24: 'lena.k', e25: 'dev_p',
  e26: 'nia.w', e27: 'nia.w', e28: 'tommy.oc', e29: 'sofi.reyes', e30: 'maya.d',
  x1: 'marcus.j',
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
