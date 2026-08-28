import { useEffect, useRef, useState } from 'react'
import { supa } from '../lib/supa.js'
import { avatarHue, avatarInitial } from '../data/people.js'
import { loadInbox, markRead, shortAgo } from '../lib/dm.js'
import GroupsPanel from './GroupsPanel.jsx'

// Messages, shaped as requests rather than an inbox.
//
// A stranger's first message waits in Requests. Answering it accepts the
// thread — there is no separate button, because replying already said yes.
// Ignoring costs nothing and tells them nothing. Blocking is silent: the other
// side never learns it happened, which is what makes it safe to use.
export default function MessagesSheet({ me, openWith, onClose, onToast, onOpenProfile, onRead }) {
  const [threads, setThreads] = useState([])
  const [names, setNames] = useState({})
  const [open, setOpen] = useState(null)   // the thread being read
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('chats')  // chats | requests | groups
  const listRef = useRef(null)

  const other = (t) => t.other ?? (t.lo === me?.id ? t.hi : t.lo)

  const loadThreads = async () => {
    const { threads: list } = await loadInbox(me?.id)
    setThreads(list)
    const ids = [...new Set(list.map((t) => t.other))].filter(Boolean)
    if (ids.length) {
      const { data: ps } = await supa.from('profiles').select('id, username').in('id', ids)
      setNames(Object.fromEntries((ps || []).map((p) => [p.id, p])))
    }
    return list
  }

  useEffect(() => { if (me) loadThreads() }, [me?.id])

  // opened from a profile: find or start the conversation with that person
  useEffect(() => {
    if (!openWith || !me) return
    let live = true
    ;(async () => {
      const list = await loadThreads()
      const found = list.find((t) => other(t) === openWith.id)
      if (found) { if (live) setOpen(found); return }
      const pair = me.id < openWith.id ? { lo: me.id, hi: openWith.id } : { lo: openWith.id, hi: me.id }
      const { data, error } = await supa.from('dm_threads').insert(pair).select().single()
      if (error) { setErr('Couldn’t start that conversation.'); return }
      setNames((n) => ({ ...n, [openWith.id]: openWith }))
      if (live) { setThreads((t) => [data, ...t]); setOpen(data) }
    })()
    return () => { live = false }
  }, [openWith?.id, me?.id])

  useEffect(() => {
    if (!open) return
    let live = true
    // clear it here too: the row keeps whatever unread flag it was loaded with,
    // so without this you read a message and come back to it still bolded
    markRead(open.id).then(() => onRead?.())
    setThreads((ts) => ts.map((x) => (x.id === open.id ? { ...x, unread: false } : x)))
    supa.from('dm_messages').select('id, author_id, body, created_at')
      .eq('thread_id', open.id).order('created_at').limit(100)
      .then(({ data }) => { if (live) setMsgs(data || []) })
    const ch = supa.channel(`dm-${open.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `thread_id=eq.${open.id}` },
        (p) => {
          setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]))
          // Their reply accepted the thread server-side; without noticing that
          // here, the sender's composer stays locked on "wait for an answer"
          // after the answer has already arrived.
          if (p.new.author_id !== me?.id) {
            setOpen((o) => (o && !o.accepted_at ? { ...o, accepted_at: new Date().toISOString() } : o))
          }
        })
      .subscribe()
    return () => { live = false; supa.removeChannel(ch) }
  }, [open?.id])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  const send = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || !open) return
    setBusy(true)
    const { error } = await supa.from('dm_messages').insert({ thread_id: open.id, body: text })
    setBusy(false)
    if (error) { setErr(error.message.replace(/^.*: /, '')); return }
    setBody('')
    setErr(null)
    // answering accepts, so the thread moves out of Requests
    if (!open.accepted_at && open.started_by !== me.id) {
      setOpen((o) => ({ ...o, accepted_at: new Date().toISOString() }))
      loadThreads()
    }
  }

  const block = async () => {
    if (!open) return
    await supa.from('blocks').insert({ blocker_id: me.id, blocked_id: other(open) })
    onToast?.('Blocked. They won’t be told.')
    setOpen(null)
    loadThreads()
  }

  const report = async () => {
    if (!open) return
    await supa.from('dm_reports').insert({ thread_id: open.id })
    onToast?.('Reported. Someone will read it.')
  }

  const who = (t) => `@${names[other(t)]?.username || 'someone'}`
  const requests = threads.filter((t) => !t.accepted_at && t.started_by !== me?.id)
  const chats = threads.filter((t) => t.accepted_at || t.started_by === me?.id)
  const shown = tab === 'requests' ? requests : chats
  const unreadIn = (list) => list.filter((t) => t.unread).length

  // A badge that opens onto an empty list is worse than no badge. If the only
  // thing waiting is a request, start there rather than on Chats.
  const landed = useRef(false)
  useEffect(() => {
    if (landed.current || !threads.length) return
    landed.current = true
    if (unreadIn(requests) > 0 && unreadIn(chats) === 0) setTab('requests')
  }, [threads.length])

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form dm-sheet" role="dialog" aria-label="Messages" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {open ? (
          <>
            <div className="dm-head">
              <button className="prof-back" onClick={() => { setOpen(null); setErr(null) }} aria-label="Back">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button className="dm-who" onClick={() => onOpenProfile?.(names[other(open)]?.username)}>
                {who(open)}
              </button>
              <div className="dm-actions">
                <button className="micro dm-act" onClick={report}>report</button>
                <button className="micro dm-act" onClick={block}>block</button>
              </div>
            </div>

            {!open.accepted_at && open.started_by !== me?.id && (
              <p className="micro dm-request-note">
                They asked to message you. Answer and the conversation opens; ignore it and
                nothing happens — an unanswered request is deleted after a month. Blocking
                is silent.
              </p>
            )}

            {/* Messages really are deleted now, so say so before somebody
                notices a conversation getting shorter and assumes a bug. */}
            <p className="micro dm-retention-note">Messages are deleted after six months.</p>

            <ul className="dm-list" ref={listRef}>
              {msgs.map((m) => (
                <li key={m.id} className={m.author_id === me?.id ? 'dm-msg dm-mine' : 'dm-msg'}>
                  {m.body}
                </li>
              ))}
            </ul>

            <form className="room-form" onSubmit={send}>
              <input
                type="text"
                maxLength="500"
                placeholder={!open.accepted_at && open.started_by === me?.id ? 'Sent — wait for an answer' : 'Say something'}
                value={body}
                onChange={(e) => { setBody(e.target.value); setErr(null) }}
                disabled={!open.accepted_at && open.started_by === me?.id && msgs.length > 0}
              />
              <button type="submit" className="btn-primary room-send" disabled={busy || !body.trim()}>
                {busy ? '…' : 'Send'}
              </button>
            </form>
            {err && <p className="form-err" role="alert">{err}</p>}
          </>
        ) : (
          <>
            <h2 className="sheet-name post-title">Messages</h2>
            <div className="aud-row" role="tablist" aria-label="Messages">
              <button
                type="button" role="tab" aria-selected={tab === 'chats'}
                className={`pill ${tab === 'chats' ? 'pill-on' : ''}`} onClick={() => setTab('chats')}
              >
                Chats{unreadIn(chats) ? ` (${unreadIn(chats)})` : ''}
              </button>
              <button
                type="button" role="tab" aria-selected={tab === 'groups'}
                className={`pill ${tab === 'groups' ? 'pill-on' : ''}`} onClick={() => setTab('groups')}
              >
                Groups
              </button>
              <button
                type="button" role="tab" aria-selected={tab === 'requests'}
                className={`pill ${tab === 'requests' ? 'pill-on' : ''}`} onClick={() => setTab('requests')}
              >
                Requests{unreadIn(requests) || requests.length ? ` (${unreadIn(requests) || requests.length})` : ''}
              </button>
            </div>

            {tab === 'groups' ? (
              <GroupsPanel me={me} onToast={onToast} />
            ) : shown.length === 0 ? (
              <p className="empty-line">
                {tab === 'requests' ? 'No requests waiting.' : 'No conversations yet.'}
              </p>
            ) : (
              <ul className="dm-threads">
                {shown.map((t) => {
                  const p = names[other(t)]
                  const hue = avatarHue(p?.username || '?')
                  return (
                    <li key={t.id}>
                      <button className={`dm-thread ${t.unread ? 'dm-unread' : ''}`} onClick={() => setOpen(t)}>
                        <span
                          className="room-ava"
                          style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}
                        >
                          {avatarInitial(p?.username || '?')}
                        </span>
                        <span className="dm-thread-text">
                          <span className="dm-thread-name">{who(t)}</span>
                          <span className="micro dm-snippet">
                            {t.last
                              ? `${t.last.author_id === me?.id ? 'You: ' : ''}${t.last.body}`
                              : 'No messages yet'}
                          </span>
                        </span>
                        <span className="dm-thread-meta">
                          <span className="micro">{shortAgo(t.last?.created_at)}</span>
                          {t.unread && <span className="dm-dot" aria-label="unread" />}
                          {!t.accepted_at && <span className="micro org-tag">{t.started_by === me?.id ? 'Sent' : 'Request'}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
