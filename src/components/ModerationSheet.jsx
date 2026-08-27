import { useEffect, useState } from 'react'
import { supa } from '../lib/supa.js'

// The queue, on a phone.
//
// Deliberately the same shape as the CLI: who reported whom and when, and NOT
// what was said. Reading someone's private conversation is a real intrusion,
// so it takes a second tap on that one thread — and the database only permits
// it while the report is open. Clearing the report closes the door, which is
// why "Clear" and "Read" sit next to each other rather than one hiding the
// other.
export default function ModerationSheet({ onClose, onToast }) {
  const [dms, setDms] = useState([])
  const [rooms, setRooms] = useState([])
  const [suspended, setSuspended] = useState([])
  const [openThread, setOpenThread] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data: reports } = await supa.from('dm_reports')
      .select('id, thread_id, note, created_at, reporter_id')
      .is('reviewed_at', null).order('created_at')
    const list = reports || []
    const threadIds = [...new Set(list.map((r) => r.thread_id))]
    const { data: threads } = threadIds.length
      ? await supa.from('dm_threads').select('id, lo, hi, started_by, accepted_at').in('id', threadIds)
      : { data: [] }
    const people = [...new Set([
      ...list.map((r) => r.reporter_id),
      ...(threads || []).flatMap((t) => [t.lo, t.hi]),
    ])]
    const { data: profs } = people.length
      ? await supa.from('profiles').select('id, username').in('id', people)
      : { data: [] }
    const byId = Object.fromEntries((profs || []).map((p) => [p.id, p.username]))
    setDms(list.map((r) => {
      const t = (threads || []).find((x) => x.id === r.thread_id)
      return {
        ...r,
        who: t ? `@${byId[t.lo] || '?'} ↔ @${byId[t.hi] || '?'}` : 'a conversation',
        reporter: byId[r.reporter_id] || '?',
        pending: t && !t.accepted_at,
        parties: t ? [t.lo, t.hi] : [],
        names: t ? [byId[t.lo], byId[t.hi]] : [],
      }
    }))

    const { data: rr } = await supa.from('room_reports').select('message_id')
    const ids = [...new Set((rr || []).map((r) => r.message_id))]
    const { data: rmsgs } = ids.length
      ? await supa.from('room_messages').select('id, spot_id, username, body, removed_at').in('id', ids)
      : { data: [] }
    setRooms(rmsgs || [])

    const { data: susp } = await supa.from('profiles')
      .select('id, username, suspended_until, suspended_reason')
      .not('suspended_until', 'is', null).gt('suspended_until', new Date().toISOString())
    setSuspended(susp || [])
  }

  useEffect(() => { load() }, [])

  // The only way in. There is no read policy on dm_messages for moderators any
  // more — this RPC checks the report is open, writes the read to admin_reads,
  // and only then hands the messages back.
  const read = async (r) => {
    const { data, error } = await supa.rpc('read_reported_thread', { t: r.thread_id })
    if (error) { onToast?.('That thread isn’t open to read.'); load(); return }
    setOpenThread(r)
    setMsgs(data || [])
  }

  const act = async (fn, msg) => {
    setBusy(true)
    await fn()
    setBusy(false)
    onToast?.(msg)
    setOpenThread(null)
    load()
  }

  const clear = (r) => act(
    () => supa.from('dm_reports').update({ reviewed_at: new Date().toISOString() }).eq('id', r.id),
    'Cleared — that thread is private again',
  )
  const bury = (m) => act(
    () => supa.from('room_messages').update({ removed_at: new Date().toISOString() }).eq('id', m.id),
    'Buried',
  )
  const suspend = (userId, name, days = 7) => act(
    () => supa.from('profiles').update({
      suspended_until: new Date(Date.now() + days * 864e5).toISOString(),
      suspended_reason: 'reported conduct',
    }).eq('id', userId),
    `@${name} can’t post for ${days} days`,
  )
  const unsuspend = (p) => act(
    () => supa.from('profiles').update({ suspended_until: null, suspended_reason: null }).eq('id', p.id),
    `@${p.username} can speak again`,
  )

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form dm-sheet" role="dialog" aria-label="Moderation" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {openThread ? (
          <>
            <div className="dm-head">
              <button className="prof-back" onClick={() => setOpenThread(null)} aria-label="Back">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <span className="dm-who">{openThread.who}</span>
            </div>
            <p className="micro dm-request-note">
              You can read this because a report on it is open. Clearing the report ends that.
              Opening it was recorded, with your name on it.
            </p>
            <ul className="dm-list">
              {msgs.map((m) => (
                <li key={m.id} className="dm-msg">
                  <span className="micro room-who">
                    @{openThread.names[openThread.parties.indexOf(m.author_id)] || 'someone'}
                  </span>
                  {m.body}
                </li>
              ))}
            </ul>
            <div className="mod-actions">
              <button className="pill" disabled={busy} onClick={() => clear(openThread)}>Nothing to do</button>
              {openThread.parties.map((id, i) => (
                id !== openThread.reporter_id && (
                  <button key={id} className="pill pill-warn" disabled={busy}
                    onClick={() => suspend(id, openThread.names[i])}>
                    Suspend @{openThread.names[i]} 7d
                  </button>
                )
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="sheet-name post-title">Moderation</h2>

            <p className="micro block-label">Reported conversations</p>
            {dms.length === 0 ? <p className="empty-line">Nothing waiting.</p> : (
              <ul className="mod-list">
                {dms.map((r) => (
                  <li key={r.id}>
                    <div className="mod-row">
                      <span className="mod-who">{r.who}</span>
                      <span className="micro">
                        reported by @{r.reporter}{r.pending ? ' · still a request' : ''}
                      </span>
                      {r.note && <span className="micro mod-note">“{r.note}”</span>}
                    </div>
                    <div className="mod-actions">
                      <button className="pill" onClick={() => read(r)}>Read it</button>
                      <button className="pill" disabled={busy} onClick={() => clear(r)}>Clear</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="micro block-label">Reported room messages</p>
            {rooms.length === 0 ? <p className="empty-line">Nothing reported.</p> : (
              <ul className="mod-list">
                {rooms.map((m) => (
                  <li key={m.id}>
                    <div className="mod-row">
                      <span className="mod-who">@{m.username} in {m.spot_id}</span>
                      <span className="micro mod-note">{m.body}</span>
                    </div>
                    <div className="mod-actions">
                      {m.removed_at
                        ? <span className="micro">buried</span>
                        : <button className="pill pill-warn" disabled={busy} onClick={() => bury(m)}>Bury it</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {suspended.length > 0 && (
              <>
                <p className="micro block-label">Suspended</p>
                <ul className="mod-list">
                  {suspended.map((p) => (
                    <li key={p.id}>
                      <div className="mod-row">
                        <span className="mod-who">@{p.username}</span>
                        <span className="micro">
                          {Math.ceil((Date.parse(p.suspended_until) - Date.now()) / 864e5)}d left
                          {p.suspended_reason ? ` · ${p.suspended_reason}` : ''}
                        </span>
                      </div>
                      <div className="mod-actions">
                        <button className="pill" disabled={busy} onClick={() => unsuspend(p)}>Lift it</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
