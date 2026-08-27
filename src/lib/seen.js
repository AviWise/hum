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
