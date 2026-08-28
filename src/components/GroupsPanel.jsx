import { useEffect, useRef, useState } from 'react'
import { supa } from '../lib/supa.js'
import { avatarHue, avatarInitial } from '../data/people.js'
import { shortAgo } from '../lib/dm.js'

// Private groups — the floor GroupMe, and anything else people want.
//
// Three gates: the code, somebody inside saying yes, and a verified address at
// that school. A code on its own travels — read across a corridor, pasted into
// a chat, screenshotted — so the code opens a conversation rather than a door.
// There is nothing to search and nothing to browse, because a searchable list
// of floor groups is the directory of who lives where.
export default function GroupsPanel({ me, onToast }) {
  const [groups, setGroups] = useState([])
  const [pending, setPending] = useState([])   // people asking to come in
  const [open, setOpen] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [body, setBody] = useState('')
  const [making, setMaking] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)

  const load = async () => {
    const { data } = await supa.from('groups').select('id, name, join_code, created_at, school_domain').order('created_at')
    setGroups(data || [])
    const { data: reqs } = await supa.from('group_join_requests')
      .select('id, group_id, user_id, requested_at').is('decided_at', null)
    const mine = (reqs || []).filter((r) => r.user_id !== me?.id)
    if (mine.length) {
      const { data: who } = await supa.from('profiles').select('id, username').in('id', mine.map((r) => r.user_id))
      const byId = Object.fromEntries((who || []).map((p) => [p.id, p]))
      setPending(mine.map((r) => ({ ...r, who: byId[r.user_id] })))
    } else setPending([])
  }
  useEffect(() => { if (me) load() }, [me?.id])

  useEffect(() => {
    if (!open) return
    let live = true
    supa.from('group_messages').select('id, author_id, username, body, created_at')
      .eq('group_id', open.id).order('created_at').limit(100)
      .then(({ data }) => { if (live) setMsgs(data || []) })
    const ch = supa.channel(`grp-${open.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${open.id}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new])))
      .subscribe()
    return () => { live = false; supa.removeChannel(ch) }
  }, [open?.id])

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length])

  const call = async (fn, args, then) => {
    setBusy(true); setErr(null)
    const { data, error } = await supa.rpc(fn, args)
    setBusy(false)
    if (error) { setErr(error.message.replace(/^.*: /, '')); return }
    await load()
    then?.(data)
  }

  const send = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || !open) return
    setBusy(true)
    const { error } = await supa.from('group_messages').insert({ group_id: open.id, body: text })
    setBusy(false)
    if (error) { setErr(error.message.replace(/^.*: /, '')); return }
    setBody(''); setErr(null)
  }

  const leave = async () => {
    await supa.from('group_members').delete().eq('group_id', open.id).eq('user_id', me.id)
    onToast?.('Left the group')
    setOpen(null); load()
  }
  const report = async () => {
    await supa.from('group_reports').insert({ group_id: open.id })
    onToast?.('Reported. Someone will read it.')
  }

  if (open) {
    return (
      <>
        <div className="dm-head">
          <button className="prof-back" onClick={() => setOpen(null)} aria-label="Back">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <span className="dm-who">{open.name}</span>
          <div className="dm-actions">
            <button className="micro dm-act" onClick={report}>report</button>
            <button className="micro dm-act" onClick={leave}>leave</button>
          </div>
        </div>
        <p className="micro dm-request-note">
          Pass on the code <strong>{open.join_code}</strong> — whoever uses it still has to be let in
          by someone here, and has to be verified at {open.school_domain}. Messages clear after a week.
        </p>

        {pending.filter((r) => r.group_id === open.id).map((r) => (
          <div key={r.id} className="grp-request">
            <span className="micro">
              <strong>@{r.who?.username || 'someone'}</strong> wants in
            </span>
            <div className="mod-actions">
              <button className="pill" disabled={busy}
                onClick={() => call('decide_group_request', { request: r.id, approve: true }, () => onToast?.('Let them in'))}>
                Let them in
              </button>
              <button className="pill" disabled={busy}
                onClick={() => call('decide_group_request', { request: r.id, approve: false }, () => onToast?.('Turned down'))}>
                No
              </button>
            </div>
          </div>
        ))}
        <ul className="dm-list" ref={listRef}>
          {msgs.map((m) => (
            <li key={m.id} className={m.author_id === me?.id ? 'dm-msg dm-mine' : 'dm-msg'}>
              {m.author_id !== me?.id && <span className="micro room-who">@{m.username}</span>}
              {m.body}
            </li>
          ))}
        </ul>
        <form className="room-form" onSubmit={send}>
          <input type="text" maxLength="500" placeholder="Where's everyone going?"
            value={body} onChange={(e) => { setBody(e.target.value); setErr(null) }} />
          <button type="submit" className="btn-primary room-send" disabled={busy || !body.trim()}>Send</button>
        </form>
        {err && <p className="form-err" role="alert">{err}</p>}
      </>
    )
  }

  return (
    <>
      {groups.length === 0 ? (
        <p className="empty-line">
          No groups yet. Start one for your floor or your friends, or join with a code somebody gave you.
        </p>
      ) : (
        <ul className="dm-threads">
          {groups.map((g) => {
            const hue = avatarHue(g.name)
            return (
              <li key={g.id}>
                <button className="dm-thread" onClick={() => setOpen(g)}>
                  <span className="room-ava org-ava-sm"
                    style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}>
                    {avatarInitial(g.name)}
                  </span>
                  <span className="dm-thread-text">
                    <span className="dm-thread-name">{g.name}</span>
                    <span className="micro dm-snippet">
                      {g.school_domain} · code {g.join_code}
                      {pending.some((r) => r.group_id === g.id) ? ' · someone’s asking to join' : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="aud-row grp-actions">
        <button className="pill" onClick={() => { setMaking((v) => !v); setErr(null) }}>
          {making ? 'Never mind' : 'Start one'}
        </button>
      </div>

      {making ? (
        <form onSubmit={(e) => { e.preventDefault(); call('create_group', { group_name: name }, (d) => { setName(''); setMaking(false); onToast?.(`Code ${d.join_code} — pass it on`) }) }}>
          <label className="micro block-label" htmlFor="grp-name">What's it called</label>
          <input id="grp-name" type="text" maxLength="50" placeholder="4th floor"
            value={name} onChange={(e) => { setName(e.target.value); setErr(null) }} />
          <button type="submit" className="btn-primary post-submit" disabled={busy || name.trim().length < 2}>
            Start it
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); call('request_group', { code }, (d) => { setCode(''); onToast?.(d.status === 'member' ? `You're already in ${d.name}` : `Asked to join ${d.name} — someone there has to say yes`) }) }}>
          <label className="micro block-label" htmlFor="grp-code">Have a code?</label>
          <input id="grp-code" type="text" maxLength="6" className="code-input" placeholder="ABC123"
            value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(null) }} />
          <button type="submit" className="btn-primary post-submit" disabled={busy || code.length < 6}>Join</button>
        </form>
      )}
      {err && <p className="form-err" role="alert">{err}</p>}
      <p className="micro aud-note">
        Groups aren’t searchable and aren’t listed anywhere. Getting in takes a code from
        someone inside, their approval, and a verified address at the same school.
      </p>
    </>
  )
}
