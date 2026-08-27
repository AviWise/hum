// A reported post disappears for the person who reported it straight away —
// they should not have to keep looking at it while a human decides. The list
// is local (it is a personal view preference); global removal is moderation.
const KEY = 'hum.reported'

const load = () => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return new Set() }
}
let mine = load()
const listeners = new Set()

export const isReported = (postId) => mine.has(postId)
export const reportedIds = () => mine

export function markReported(postId) {
  mine.add(postId)
  try { localStorage.setItem(KEY, JSON.stringify([...mine])) } catch { /* private mode */ }
  for (const fn of listeners) fn(mine)
}

export function onReportedChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
