import { supa } from './supa.js'

// One loader for the inbox, used by the badge and by the sheet — otherwise the
// count and the list drift apart and a badge points at nothing.
export async function loadInbox(meId) {
  if (!meId) return { threads: [], unread: 0 }
  const [{ data: threads }, { data: recent }, { data: reads }] = await Promise.all([
    supa.from('dm_threads').select('id, lo, hi, started_by, accepted_at, created_at'),
    // RLS already limits this to threads you are in, so the newest few hundred
    // messages across your conversations is exactly your own mail
    supa.from('dm_messages').select('thread_id, author_id, body, created_at')
      .order('created_at', { ascending: false }).limit(300),
    supa.from('dm_reads').select('thread_id, read_at'),
  ])

  const lastOf = {}
  for (const m of recent || []) if (!lastOf[m.thread_id]) lastOf[m.thread_id] = m
  const readAt = Object.fromEntries((reads || []).map((r) => [r.thread_id, Date.parse(r.read_at)]))

  const list = (threads || []).map((t) => {
    const last = lastOf[t.id] || null
    const seen = readAt[t.id] || 0
    return {
      ...t,
      other: t.lo === meId ? t.hi : t.lo,
      last,
      // a message you sent is never unread to you
      unread: !!last && last.author_id !== meId && Date.parse(last.created_at) > seen,
    }
  }).sort((a, b) => Date.parse(b.last?.created_at || b.created_at) - Date.parse(a.last?.created_at || a.created_at))

  return { threads: list, unread: list.filter((t) => t.unread).length }
}

export const markRead = (threadId) =>
  supa.from('dm_reads').upsert({ thread_id: threadId }, { onConflict: 'user_id,thread_id' })

// "2m" / "4h" / "3d" — the timestamp every thread list has and ours did not
export function shortAgo(iso) {
  if (!iso) return ''
  const mins = (Date.now() - Date.parse(iso)) / 60000
  if (mins < 1) return 'now'
  if (mins < 60) return `${Math.round(mins)}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  const d = Math.round(mins / 1440)
  return d < 7 ? `${d}d` : `${Math.round(d / 7)}w`
}
