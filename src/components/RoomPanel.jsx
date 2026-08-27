import { useEffect, useRef, useState } from 'react'
import { supa } from '../lib/supa.js'
import { avatarHue, avatarInitial } from '../data/people.js'

// The room at a place. Public within the app, alive for six hours, gone after.
// Not a DM channel with extra steps: everyone at the spot sees it, which is
// what keeps it self-policing.
export default function RoomPanel({ spotId, spotName, me, onNeedAccount, onOpenProfile }) {
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (!spotId) return
    let live = true
    supa.from('room_messages').select('id, username, body, created_at, author_id')
      .eq('spot_id', spotId).order('created_at').limit(60)
      .then(({ data }) => { if (live) setMsgs(data || []) })

    const ch = supa.channel(`room-${spotId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `spot_id=eq.${spotId}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_messages' },
        (p) => setMsgs((m) => m.filter((x) => x.id !== p.old.id)))
      .subscribe()
    return () => { live = false; supa.removeChannel(ch) }
  }, [spotId])

  // keep the newest in view without yanking the whole sheet around
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  const send = async (e) => {
    e.preventDefault()
    if (!me) { onNeedAccount?.(); return }
    const text = body.trim()
    if (!text) return
    setBusy(true)
    const { error } = await supa.from('room_messages').insert({ spot_id: spotId, body: text })
    setBusy(false)
    if (error) { setErr(error.message.replace(/^.*: /, '')); return }
    setBody('')
    setErr(null)
  }

  const mine = (m) => me && m.author_id === me.id

  return (
    <section className="room" aria-label={`Room at ${spotName}`}>
      <p className="micro block-label">
        In the room
        <span className="room-note"> · everyone here sees this, and it clears in a few hours</span>
      </p>

      {msgs.length === 0 ? (
        <p className="empty-line room-empty">Nobody’s said anything yet. How is it?</p>
      ) : (
        <ul className="room-list" ref={listRef}>
          {msgs.map((m) => (
            <li key={m.id} className={mine(m) ? 'room-msg room-mine' : 'room-msg'}>
              <button
                className="room-ava"
                style={{ '--ava-bg': `oklch(0.82 0.06 ${avatarHue(m.username || '?')})`, '--ava-ink': `oklch(0.42 0.09 ${avatarHue(m.username || '?')})` }}
                onClick={() => m.username && onOpenProfile?.(m.username)}
                aria-label={`@${m.username}`}
              >
                {avatarInitial(m.username || '?')}
              </button>
              <span className="room-body">
                <span className="micro room-who">@{m.username}</span>
                {m.body}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="room-form" onSubmit={send}>
        <input
          type="text"
          maxLength="300"
          placeholder={me ? 'How is it right now?' : 'Sign in to say something'}
          value={body}
          onChange={(e) => { setBody(e.target.value); setErr(null) }}
          onFocus={() => { if (!me) onNeedAccount?.() }}
        />
        <button type="submit" className="btn-primary room-send" disabled={busy || !body.trim()}>
          {busy ? '…' : 'Say it'}
        </button>
      </form>
      {err && <p className="form-err" role="alert">{err}</p>}
    </section>
  )
}
