import { useEffect, useState } from 'react'
import { CATEGORIES, crowdWord, liveBusy, typicalHours, venueFor } from '../data/spots.js'
import { avatarHue, avatarInitial } from '../data/people.js'
import { thumb, mid, srcSetOf, dimsOf } from '../lib/img.js'
import { watchImpression } from '../lib/impressions.js'
import { isReported, onReportedChange } from '../lib/reported.js'
import ReportButton from './ReportButton.jsx'
import { ILLOS } from './Illustrations.jsx'
import { artUrl } from './markerArt.js'
import { spotPhoto, GALLERIES } from '../data/photos.js'
import META from '../data/spotmeta.json' with { type: 'json' }
import { timeLeft } from '../lib/time.js'
import { supa } from '../lib/supa.js'

const timeAgo = (ts, now) => {
  const m = Math.max(1, Math.round((now - Date.parse(ts)) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

export default function SpotSheet({ spot, events, now, onClose, onPost, authed, me, onNeedAccount, onOpenProfile, onToast }) {
  const cat = CATEGORIES[spot.cat]
  const hours = typicalHours(spot, now)
  const [rt, setRt] = useState(null) // realtime foot traffic from the edge function
  const [armed, setArmed] = useState(null) // report confirmation state
  const [reported, setReported] = useState(() => new Set())
  const [recents, setRecents] = useState([]) // the durable record of who's been here
  const [sort, setSort] = useState('popular')
  const [openComments, setOpenComments] = useState(null) // post id
  const [comments, setComments] = useState({}) // post id -> rows
  const [draft, setDraft] = useState('')
  const [commentErr, setCommentErr] = useState(null)

  useEffect(() => {
    setRecents([]); setOpenComments(null); setComments({})
    supa.from('posts')
      .select('id, title, created_at, expires_at, username, photo_path, mid_path, featured, likes(user_id), comments(count)')
      .eq('spot_id', spot.id)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => { if (data) setRecents(data) })
  }, [spot.id])

  // clipboard writes fail quietly without focus or a secure context, so keep a
  // synchronous fallback rather than leaving the tap with nothing to show
  const copyFallback = (text) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    return ok
  }

  const share = async () => {
    const url = `${location.origin}${import.meta.env.BASE_URL}?spot=${spot.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${spot.name} — out.`, text: `${spot.name}: ${spot.vibe}`, url })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return // they changed their mind; not an error
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      onToast?.('Link copied')
    } catch {
      onToast?.(copyFallback(url) ? 'Link copied' : url)
    }
  }

  const toggleLike = async (post) => {
    if (!authed) { onNeedAccount(); return }
    const liked = post.likes.some((l) => l.user_id === me)
    if (!liked) { try { navigator.vibrate?.(8) } catch { /* no haptics here */ } }
    setRecents((rs) => rs.map((r) => r.id !== post.id ? r : {
      ...r,
      likes: liked ? r.likes.filter((l) => l.user_id !== me) : [...r.likes, { user_id: me }],
    }))
    if (liked) await supa.from('likes').delete().eq('post_id', post.id).eq('user_id', me)
    else await supa.from('likes').insert({ post_id: post.id })
  }

  const showComments = async (postId) => {
    if (openComments === postId) { setOpenComments(null); return }
    setOpenComments(postId)
    setCommentErr(null)
    if (!comments[postId]) {
      const { data } = await supa.from('comments').select('username, body, created_at').eq('post_id', postId).order('created_at').limit(50)
      setComments((c) => ({ ...c, [postId]: data || [] }))
    }
  }

  const sendComment = async (postId) => {
    if (!authed) { onNeedAccount(); return }
    const body = draft.trim()
    if (!body) return
    const { data, error } = await supa.from('comments').insert({ post_id: postId, body }).select('username, body, created_at').single()
    if (error) { setCommentErr(error.message); return }
    setDraft('')
    setComments((c) => ({ ...c, [postId]: [...(c[postId] || []), data] }))
    setRecents((rs) => rs.map((r) => r.id !== postId ? r : { ...r, comments: [{ count: (r.comments?.[0]?.count || 0) + 1 }] }))
  }

  const sorted = [...recents].filter((p) => !isReported(p.id)).sort((a, b) => sort === 'popular'
    ? (b.likes.length - a.likes.length) || (Date.parse(b.created_at) - Date.parse(a.created_at))
    : Date.parse(b.created_at) - Date.parse(a.created_at))

  const report = async (evId) => {
    if (!authed) { onNeedAccount(); return }
    if (armed !== evId) { setArmed(evId); return }
    setArmed(null)
    const { error } = await supa.from('reports').insert({ post_id: evId.slice(2) })
    if (!error || error.code === '23505') setReported((r) => new Set(r).add(evId))
  }

  useEffect(() => {
    setRt(null)
    const v = venueFor(spot.id)
    if (!v) return
    const ctrl = new AbortController()
    fetch('https://hxmjszgvkynrwscelnzx.supabase.co/functions/v1/busy-live', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX',
      },
      body: JSON.stringify({ spot_id: spot.id, venue_name: v.venue, venue_address: v.addr }),
    })
      .then((r) => r.json())
      .then((d) => { if (d && d.live_available) setRt(d) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [spot.id])

  // prefer the actual live reading when we have one
  const live = rt
    ? Math.max(4, Math.min(100, Math.round((rt.live_busyness / 100) * spot.busy * 1.15)))
    : liveBusy(spot, now)
  const word = crowdWord(live)
  const delta = rt && rt.forecast_busyness != null ? rt.live_busyness - rt.forecast_busyness : null
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section
        className="sheet sheet-tinted"
        role="dialog"
        aria-label={spot.name}
        onClick={(e) => e.stopPropagation()}
        style={{ '--tint': cat.color, '--tint-deep': cat.deep }}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head">
          {(spotPhoto(spot.id) || artUrl(spot.art)) && (
            <img className="sheet-art" src={thumb(spotPhoto(spot.id)?.src) || artUrl(spot.art)} alt="" />
          )}
          <div>
            <h2 className="sheet-name">{spot.name}</h2>
            <p className="micro sheet-area">
              {spot.area} <span aria-hidden="true">·</span> <span className="sheet-kind">{cat.label}</span>
            </p>
          </div>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="crowd">
          <div className="crowd-meter" role="img" aria-label={`${word} — busyness ${live} out of 100`}>
            <div className="crowd-fill" style={{ width: `${live}%` }} />
          </div>
          <span className="crowd-word">{word} right now</span>
        </div>
        {rt && (
          <p className="micro hours-line live-line">
            live: {rt.live_busyness}% full
            {delta !== null && (
              <> · {delta > 12 ? 'busier than usual' : delta < -12 ? 'quieter than usual' : 'about as usual'}</>
            )}
          </p>
        )}
        {hours && (
          <p className="micro hours-line">
            {hours.closed ? 'typically closed today' : `typically open ${hours.label} today`} · from foot-traffic data
          </p>
        )}

        {(() => {
          const lead = spotPhoto(spot.id)
          const community = recents.filter((r) => r.featured && r.photo_path).map((r) => ({ src: r.photo_path, by: r.username }))
          const shots = [...(lead ? [lead] : []), ...(GALLERIES[spot.id] || []), ...community]
          if (shots.length < 2) return null
          return (
            <div className="shot-strip" aria-label="Photos">
              {shots.map((g, i) => {
                const d = dimsOf(g.src)
                return (
                  <span key={i} className="shot-wrap">
                    <img
                      src={mid(g.src)}
                      srcSet={srcSetOf(g.src)}
                      sizes="184px"
                      width={d?.[0]}
                      height={d?.[1]}
                      alt=""
                      loading="lazy"
                      className="shot"
                    />
                    {g.by && <span className="shot-by">@{g.by}</span>}
                  </span>
                )
              })}
            </div>
          )
        })()}

        <p className="vibe">“{spot.vibe}”</p>

        {(META[spot.id]?.peak || META[spot.id]?.station) && (
          <div className="info-rows">
            {META[spot.id].peak && (
              <p className="info-row">
                <span className="micro info-k">busiest</span>
                <span className="info-v">{META[spot.id].peak}</span>
              </p>
            )}
            {META[spot.id].station && (
              <p className="info-row">
                <span className="micro info-k">metro</span>
                <span className="info-v">
                  {META[spot.id].station.name}
                  <span className="train-transfers">
                    {META[spot.id].station.lines.map((l) => (
                      <span key={l} className="pop-line-dot" style={{ background: { red: '#B34A56', orange: '#D28A3C', yellow: '#CFAC46', green: '#4E9163', blue: '#4E7FA3', silver: '#989184' }[l] }} />
                    ))}
                  </span>
                  {' '}· {META[spot.id].station.walk} min walk
                </span>
              </p>
            )}
            <p className="info-row">
              <span className="micro info-k">directions</span>
              <span className="info-v dir-links">
                <a href={`https://maps.apple.com/?daddr=${spot.coords[1]},${spot.coords[0]}&q=${encodeURIComponent(spot.name)}`} target="_blank" rel="noreferrer">Apple Maps</a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.coords[1]},${spot.coords[0]}`} target="_blank" rel="noreferrer">Google Maps</a>
              </span>
            </p>
            <p className="info-row">
              <span className="micro info-k">share</span>
              <span className="info-v dir-links">
                <button type="button" className="share-btn" onClick={share}>Send to friends</button>
              </span>
            </p>
          </div>
        )}

        <p className="micro block-label">The anchors</p>
        <ul className="venues">
          {spot.venues.map((v) => <li key={v}>{v}</li>)}
        </ul>

        <p className="micro block-label">Happening here</p>
        {events.length === 0 ? (
          <p className="empty-line">Nothing posted yet tonight — be the first.</p>
        ) : (
          <ul className="sheet-events">
            {events.map((ev) => {
              const Illo = ev.photo ? ILLOS[ev.photo] : null
              return (
                <li key={ev.id} className={ev.dying ? 'dying' : ''}>
                  {Illo && <div className="sheet-ev-illo"><Illo /></div>}
                  <div className="sheet-ev-body">
                    <p className="sheet-ev-title">{ev.title}{!ev.id.startsWith('u-') && <span className="demo-tag micro">Demo</span>}</p>
                    <p className={`micro countdown ${ev.endsAt - now < 30 * 60000 ? 'closing' : ''}`}>
                      {ev.by && (
                        <>
                          <button type="button" className="ev-by ev-by-link" onClick={() => onOpenProfile?.(ev.by)}>@{ev.by}</button>
                          <span className="ev-by"> · </span>
                        </>
                      )}
                      {timeLeft(ev.endsAt, now)} left
                      {ev.id.startsWith('u-') && (
                        <button
                          type="button"
                          className={`report-btn ${armed === ev.id ? 'report-armed' : ''}`}
                          onClick={() => report(ev.id)}
                          disabled={reported.has(ev.id)}
                        >
                          {reported.has(ev.id) ? 'reported' : armed === ev.id ? 'tap again to report' : 'report'}
                        </button>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {sorted.length > 0 && (
          <>
            <div className="rec-head">
              <p className="micro block-label">Who’s been here</p>
              <div className="rec-sort" role="radiogroup" aria-label="Sort posts">
                {['popular', 'recent'].map((s) => (
                  <button key={s} role="radio" aria-checked={sort === s} className={`rec-sort-btn ${sort === s ? 'on' : ''}`} onClick={() => setSort(s)}>{s}</button>
                ))}
              </div>
            </div>
            <ul className="rec-list">
              {sorted.map((p) => {
                const liked = p.likes.some((l) => l.user_id === me)
                const nComments = p.comments?.[0]?.count || 0
                const live = Date.parse(p.expires_at) > now
                const hue = avatarHue(p.username || '?')
                return (
                  <li key={p.id} className="rec-card" ref={(el) => watchImpression(el, p.id)}>
                    <header className="rec-top">
                      <button className="rec-ava" style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }} onClick={() => p.username && onOpenProfile?.(p.username)}>
                        {avatarInitial(p.username)}
                      </button>
                      <button className="rec-user" onClick={() => p.username && onOpenProfile?.(p.username)}>@{p.username || 'someone'}</button>
                      <span className="micro rec-when">{live ? 'live now' : timeAgo(p.created_at, now)}</span>
                    </header>
                    {(p.mid_path || p.photo_path) && <img className="rec-photo" src={p.mid_path || p.photo_path} alt="" loading="lazy" />}
                    <p className="rec-title">{p.title}</p>
                    <div className="rec-actions">
                      <button
                        className={`rec-like ${liked ? 'liked' : ''}`}
                        style={{ '--like': cat.color }}
                        aria-pressed={liked}
                        onClick={() => toggleLike(p)}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.4C5 11.2 2.4 9 2.4 6.4a3 3 0 0 1 5.2-2 .5.5 0 0 0 .8 0 3 3 0 0 1 5.2 2c0 2.6-2.6 4.8-5.6 7z" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                        {p.likes.length > 0 && p.likes.length}
                      </button>
                      <ReportButton postId={p.id} authed={authed} onNeedAccount={onNeedAccount} className="rec-report" />
                      <button className="rec-comment" onClick={() => showComments(p.id)}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6c3.5 0 6 2.1 6 4.9s-2.5 4.9-6 4.9c-.6 0-1.2-.06-1.8-.2L3.4 13.4l.7-2.5C2.9 10 2 8.9 2 7.5c0-2.8 2.5-4.9 6-4.9z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                        {nComments > 0 && nComments}
                      </button>
                    </div>
                    {openComments === p.id && (
                      <div className="rec-comments">
                        {(comments[p.id] || []).map((c, i) => (
                          <p key={i} className="rec-c"><strong>@{c.username || 'someone'}</strong> {c.body}</p>
                        ))}
                        {(comments[p.id] || []).length === 0 && <p className="micro rec-c-empty">No comments yet.</p>}
                        {commentErr && <p className="form-err">{commentErr}</p>}
                        <div className="rec-c-row">
                          <input
                            type="text"
                            maxLength="200"
                            placeholder={authed ? 'Say something…' : 'Sign in to comment'}
                            value={draft}
                            onFocus={() => { if (!authed) onNeedAccount() }}
                            onChange={(e) => { setDraft(e.target.value); setCommentErr(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') sendComment(p.id) }}
                          />
                          <button className="rec-c-send" onClick={() => sendComment(p.id)} disabled={!draft.trim()}>post</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <button className="btn-primary sheet-post" onClick={() => onPost(spot.id)}>Post from {spot.name}</button>
        {spotPhoto(spot.id)?.credit && (
          <p className="photo-credit">
            Photo:{' '}
            <a href={spotPhoto(spot.id).source} target="_blank" rel="noreferrer">
              {spotPhoto(spot.id).credit}
            </a>{' '}
            · {spotPhoto(spot.id).license}
          </p>
        )}
      </section>
    </div>
  )
}
