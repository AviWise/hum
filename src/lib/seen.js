// Which stories you've already watched.
//
// A story ring that appears for everyone with a live post is decoration: it
// says "this person exists", which you knew. Instagram's ring means *unseen*,
// and that is the whole reason it earns a tap. Kept per viewer in
// localStorage, stamped with the newest post it covered so a fresh post
// re-lights a ring you had already cleared.
const KEY = 'out.seenStories'

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function markSeen(username, stamp) {
  if (!username || !stamp) return
  try {
    const all = read()
    all[username] = Math.max(stamp, all[username] || 0)
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch { /* private mode: rings just stay lit, which is the safe failure */ }
}

// unseen when there is something to see and it is newer than what you watched
export const isUnseen = (username, stamp) =>
  !!stamp && stamp > (read()[username] || 0)

// Which posts you have already been shown on Tonight.
//
// The complaint this answers: "I saw them yesterday, I'm not interested."
// A page that reshows the same thing with the same emphasis every day teaches
// you that nothing on it is new, and then you stop reading it.
const EKEY = 'out.seenEvents'

const readE = () => {
  try { return JSON.parse(localStorage.getItem(EKEY) || '{}') } catch { return {} }
}

export function markEventsSeen(ids) {
  if (!ids?.length) return
  try {
    const all = readE()
    const now = Date.now()
    for (const id of ids) if (!all[id]) all[id] = now
    // forget anything older than a fortnight, or this grows forever
    const cutoff = now - 14 * 864e5
    for (const k of Object.keys(all)) if (all[k] < cutoff) delete all[k]
    localStorage.setItem(EKEY, JSON.stringify(all))
  } catch { /* private mode: everything reads as new, which is the kind failure */ }
}

export const isNewToYou = (id) => !readE()[id]
