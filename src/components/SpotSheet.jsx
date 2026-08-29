import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, crowdWord, busyLevel, vsUsual, typicalHours, venueFor, busySource } from '../data/spots.js'
import { VENUE_INFO, eventsForSpot, upcomingForSpot, recurringForSpot, standingForSpot, isArena } from '../data/venueinfo.js'
import { avatarHue, avatarInitial } from '../data/people.js'
import { thumb, mid, srcSetOf, dimsOf } from '../lib/img.js'
import { watchImpression } from '../lib/impressions.js'
import { isReported, onReportedChange } from '../lib/reported.js'
import ReportButton from './ReportButton.jsx'
import RoomPanel from './RoomPanel.jsx'
import { ILLOS } from './Illustrations.jsx'
import { artUrl } from './markerArt.js'
import { spotPhoto, GALLERIES } from '../data/photos.js'
import META from '../data/spotmeta.json' with { type: 'json' }
import { timeLeft } from '../lib/time.js'
import { supa } from '../lib/supa.js'
import { shareOrCopy } from '../lib/share.js'
import { shareUrlFor, slugify } from '../lib/router.js'

const timeAgo = (ts, now) => {
  const m = Math.max(1, Math.round((now - Date.parse(ts)) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

// "Fri 5" rather than a date — the question is which night, not which number.
//
// Composed by hand because toLocaleDateString('en-US', {weekday, day}) with no
// month returns "5 Fri", not "Fri 5". A quirk of that field combination, not of
// the locale.
const fmtDay = (ymd) => {
  const d = new Date(ymd + 'T12:00:00')
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`
}

const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return m ? `${hr}:${String(m).padStart(2, '0')}${ampm}` : `${hr}${ampm}`
}

export default function SpotSheet({ spot, events, now, onClose, onPost, authed, me, onNeedAccount, onOpenProfile, onToast }) {
  const cat = CATEGORIES[spot.cat]
  const hours = typicalHours(spot, now)
  // Two sources, one list. Dated line-ups expire by date; recurring programmes
  // are rules ("second Thursday, spring and fall") and never do.
  const onTonight = [
    ...eventsForSpot(spot.id, now).filter((e) => !isArena(e.venue))
      .map((e) => ({ time: e.time, lead: e.venue, body: e.title })),
    ...recurringForSpot(spot.id, now).map((r) => ({
      time: r.when && r.time, lead: r.name, body: r.blurb, note: r.note, until: r.until,
    })),
  ].sort((a, b) => String(a.time).localeCompare(String(b.time)))
  const standing = standingForSpot(spot.id)
  // Everything after today. U Street alone has 46 in the next four weeks, so
  // this is capped and expandable rather than dumped in full.
  const todayKey = new Date(now).toISOString().slice(0, 10)
  const allUpcoming = upcomingForSpot(spot.id, now, 28).filter((e) => e.date > todayKey)
  // A ball game and a DJ set are not the same errand. Split rather than
  // interleave, so "coming up" stays a list of nights out.
  const upcoming = allUpcoming.filter((e) => !isArena(e.venue))
  const bigTicket = [
    ...eventsForSpot(spot.id, now).filter((e) => isArena(e.venue)).map((e) => ({ ...e, today: true })),
    ...allUpcoming.filter((e) => isArena(e.venue)),
  ]
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllBig, setShowAllBig] = useState(false)
  const UPCOMING_SHOWN = 4
  const [rt, setRt] = useState(null) // realtime foot traffic from the edge function
  const [recents, setRecents] = useState([]) // the durable record of who's been here
  const [sort, setSort] = useState('popular')
  const [openComments, setOpenComments] = useState(null) // post id
  const [comments, setComments] = useState({}) // post id -> rows
  const [draft, setDraft] = useState('')
  const [commentErr, setCommentErr] = useState(null)

  useEffect(() => {
    setRecents([]); setOpenComments(null); setComments({})
    supa.from('posts')
      .select('id, title, created_at, expires_at, username, photo_path, mid_path, featured, is_demo, likes(user_id), comments(count)')
      .eq('spot_id', spot.id)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => { if (data) setRecents(data) })
  }, [spot.id])

  const share = () => shareOrCopy({
    title: `${spot.name} — hum.`,
    text: `${spot.name}: ${spot.vibe}`,
    // the /s/ page carries this spot's own title, photo and description for
    // whatever app the link lands in, then bounces the person into the map
    url: shareUrlFor(slugify(spot.name)),
  }, onToast)

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
      // the venue is not ours to name any more: the function looks it up in
      // spot_venues, so no caller can aim our paid key at an arbitrary place
      body: JSON.stringify({ spot_id: spot.id }),
    })
      .then((r) => r.json())
      .then((d) => { if (d && d.live_available) setRt(d) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [spot.id])

  // How full this place is, on its own scale. A live reading when we have one,
  // otherwise the forecast. Deliberately not liveBusy(): that is the map's
  // relative weight, and running a percentage through it made "Packed"
  // unreachable for 107 of 116 spots.
  const level = rt && rt.live_busyness != null ? Math.round(rt.live_busyness) : busyLevel(spot, now)
  const word = crowdWord(level)
  // a real live reading beats the model; without one, compare against how this
  // place normally is at this hour rather than saying nothing
  const delta = rt && rt.forecast_busyness != null ? rt.live_busyness - rt.forecast_busyness : null
  const usual = delta !== null
    ? (delta > 12 ? 'busier than usual' : delta < -12 ? 'quieter than usual' : 'about as usual')
    : vsUsual(spot, now)?.word || null
  // Apple Maps' sheet, because a map app whose panel covers the map is a list
  // app. Three stops; the map stays live behind at the lower two. Height rather
  // than transform so the content is reachable by scrolling at every stop
  // instead of hanging off the bottom of the screen.
  const DETENTS = [0.42, 0.7, 0.94]
  const [detent, setDetent] = useState(1)
  const [dragging, setDragging] = useState(false)
  const sheetRef = useRef(null)
  const dragRef = useRef(null)
  const swallow = useRef(false)
  const phone = () => window.matchMedia('(max-width: 899px)').matches

  // Listeners go on the window for the duration of the drag rather than on the
  // handle. The handle is ~40px tall, so the pointer leaves it on the first
  // move and element-bound handlers simply stop firing; pointer capture would
  // fix that but capturing on pointerdown redirects the click and kills
  // tap-to-cycle. The window sees everything and steals nothing.
  const onDragStart = (e) => {
    if (!phone() || dragRef.current) return
    const el = sheetRef.current
    if (!el) return
    const d = { y: e.clientY, h: el.getBoundingClientRect().height, moved: false }
    dragRef.current = d
    setDragging(true)

    const move = (ev) => {
      const dy = d.y - ev.clientY
      if (!d.moved && Math.abs(dy) > 3) d.moved = true
      if (!d.moved) return
      const vh = window.innerHeight
      const max = vh * DETENTS[2]
      const raw = d.h + dy
      d.h2 = Math.max(vh * 0.12, raw > max ? max + (raw - max) * 0.3 : raw)
      if (sheetRef.current) sheetRef.current.style.height = `${d.h2}px`
      ev.preventDefault()
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      dragRef.current = null
      setDragging(false)
      if (sheetRef.current) sheetRef.current.style.height = ''
      if (!d.moved) return
      // The sheet shrinks up to meet the finger, so a downward drag often
      // releases ON the handle — and tap-to-cycle then immediately undoes the
      // drag. Swallow the one click that follows a real drag.
      swallow.current = true
      const vh = window.innerHeight
      const frac = (d.h2 ?? d.h) / vh
      if (frac < DETENTS[0] * 0.62) { onClose(); return }
      let best = 0
      DETENTS.forEach((v, i) => {
        if (Math.abs(v - frac) < Math.abs(DETENTS[best] - frac)) best = i
      })
      setDetent(best)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <div
      className="sheet-scrim scrim-detent"
      onClick={() => {
        // On a phone the map behind is live and the sheet has both a close
        // button and drag-down, so tap-to-close only ever fires by accident —
        // most reliably when a drag releases over the map and the click lands
        // here. Apple Maps does not close on a map tap either.
        if (!phone()) onClose()
      }}
    >
      <section
        ref={sheetRef}
        className={`sheet sheet-tinted sheet-detent ${dragging ? 'sheet-dragging' : ''}`}
        role="dialog"
        aria-label={spot.name}
        onClick={(e) => e.stopPropagation()}
        style={{ '--tint': cat.color, '--tint-deep': cat.deep, '--detent': `${DETENTS[detent] * 100}dvh` }}
      >
        <div
          className="sheet-drag"
          onPointerDown={onDragStart}
          onClickCapture={(e) => {
            if (!swallow.current) return
            swallow.current = false
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          <button
            className="sheet-grab"
            aria-label={`Sheet position: ${['peek', 'half', 'full'][detent]} — tap to expand`}
            onClick={() => setDetent((d) => (d + 1) % 3)}
          />
        </div>
        <header className="sheet-head">
          {(spotPhoto(spot.id) || artUrl(spot.art)) && (
            <span className="sheet-art-wrap">
              <img className="sheet-art" src={thumb(spotPhoto(spot.id)?.src) || artUrl(spot.art)} alt="" />
              {spotPhoto(spot.id)?.credit && (GALLERIES[spot.id] || []).length === 0 && (
                <a
                  className="shot-credit sheet-art-credit"
                  href={spotPhoto(spot.id).source}
                  target="_blank"
                  rel="noreferrer"
                  title={`Photo: ${spotPhoto(spot.id).credit} · ${spotPhoto(spot.id).license}`}
                  aria-label={`Photo credit: ${spotPhoto(spot.id).credit}, ${spotPhoto(spot.id).license}`}
                >i</a>
              )}
            </span>
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
          <div className="crowd-meter" role="img" aria-label={`${word} — busyness ${level} out of 100`}>
            {/* the bar caps at full; the word is what carries a surge past 100 */}
            <div className="crowd-fill" style={{ width: `${Math.min(100, level)}%` }} />
          </div>
          <span className="crowd-word">{word} {rt ? 'right now' : 'around now'}</span>
        </div>
        {/* "right now" was asserted for every spot, including the 87 with no
            foot-traffic data at all, and including all of them once BestTime's
            quota ran out and `rt` stopped arriving. Say which of the three
            things this number actually is. */}
        {!rt && (
          <p className="crowd-basis">
            {`Typical for a ${new Date(now).toLocaleDateString('en-US', { weekday: 'long' })} at this hour`}
            {/* measured spots carry provenance on the typicalHours line below,
                so only the estimated case has to account for itself here */}
            {busySource(spot) === 'measured' ? '' : ' · estimated from similar places'}
          </p>
        )}
        {rt && (
          <p className="micro hours-line live-line">
            live: {rt.live_busyness}% full
            {usual && (
              <> · {usual}</>
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
            <div className="shot-wrap-outer">
            {spotPhoto(spot.id)?.credit && (
              <a
                className="shot-credit"
                href={spotPhoto(spot.id).source}
                target="_blank"
                rel="noreferrer"
                title={`Photo: ${spotPhoto(spot.id).credit} · ${spotPhoto(spot.id).license}`}
                aria-label={`Photo credit: ${spotPhoto(spot.id).credit}, ${spotPhoto(spot.id).license}`}
              >i</a>
            )}
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
            </div>
          )
        })()}

        <p className="vibe">“{spot.vibe}”</p>

        {(META[spot.id]?.peak || META[spot.id]?.station) && (
          <p className="spot-facts micro">
            {META[spot.id].peak && <span>{META[spot.id].peak}</span>}
            {META[spot.id].station && (
              <span>
                {META[spot.id].station.name}
                <span className="train-transfers">
                  {META[spot.id].station.lines.map((l) => (
                    <span key={l} className="pop-line-dot" style={{ background: { red: '#B34A56', orange: '#D28A3C', yellow: '#CFAC46', green: '#4E9163', blue: '#4E7FA3', silver: '#989184' }[l] }} />
                  ))}
                </span>
                {' '}{META[spot.id].station.walk} min
              </span>
            )}
          </p>
        )}

        <ul className="venues venues-standalone">
          {spot.venues.map((v) => {
            const info = VENUE_INFO[v]
            // hours as a tooltip rather than inline: the chips are a glance, and
            // 44 of the 334 venue names have hours, so inlining them would make
            // a ragged list where most entries said nothing
            return <li key={v} title={info?.hours || undefined} className={info ? 'venue-known' : undefined}>{v}</li>
          })}
        </ul>

        {/* Dated line-ups for the venues inside this spot. These expire by date:
            once the day passes they stop rendering and the section disappears,
            rather than sitting here going quietly wrong. */}
        {onTonight.length > 0 && (
          <>
            <p className="micro block-label">On tonight</p>
            <ul className="sheet-lineup">
              {onTonight.map((e, i) => (
                <li key={e.lead + e.time + i}>
                  <span className="lineup-time">{fmtTime(e.time)}{e.until ? `–${fmtTime(e.until)}` : ''}</span>
                  <span className="lineup-body">
                    <strong>{e.lead}</strong>{e.body ? <> · {e.body}</> : null}
                    {e.note ? <em className="lineup-note">{e.note}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <p className="micro block-label">Coming up</p>
            <ul className="sheet-lineup">
              {(showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_SHOWN)).map((e, i) => (
                <li key={e.venue + e.date + e.time + i}>
                  <span className="lineup-time">{fmtDay(e.date)}</span>
                  <span className="lineup-body"><strong>{e.venue}</strong> · {e.title}</span>
                </li>
              ))}
            </ul>
            {upcoming.length > UPCOMING_SHOWN && (
              <button type="button" className="acct-signout lineup-more"
                onClick={() => setShowAllUpcoming((v) => !v)}>
                {showAllUpcoming ? 'show less' : `all ${upcoming.length} coming up`}
              </button>
            )}
          </>
        )}

        {bigTicket.length > 0 && (
          <>
            <p className="micro block-label">
              {[...new Set(bigTicket.map((e) => e.venue))].join(' · ')}
            </p>
            <ul className="sheet-lineup sheet-lineup-big">
              {(showAllBig ? bigTicket : bigTicket.slice(0, UPCOMING_SHOWN)).map((e, i) => (
                <li key={e.venue + e.date + e.time + i}>
                  <span className="lineup-time">{e.today ? fmtTime(e.time) : fmtDay(e.date)}</span>
                  <span className="lineup-body">{e.title}</span>
                </li>
              ))}
            </ul>
            {bigTicket.length > UPCOMING_SHOWN && (
              <button type="button" className="acct-signout lineup-more"
                onClick={() => setShowAllBig((v) => !v)}>
                {showAllBig ? 'show less' : `all ${bigTicket.length} fixtures`}
              </button>
            )}
          </>
        )}

        {standing.map((r) => (
          <p key={r.name} className="crowd-basis"><strong>{r.name}</strong> · {r.blurb}</p>
        ))}

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
                    <p className="sheet-ev-title">{ev.title}{(!ev.id.startsWith('u-') || ev.demo) && <span className="demo-tag micro">Demo</span>}</p>
                    <p className={`micro countdown ${ev.endsAt - now < 30 * 60000 ? 'closing' : ''}`}>
                      {ev.by && (
                        <>
                          <button type="button" className="ev-by ev-by-link" onClick={() => onOpenProfile?.(ev.by)}>@{ev.by}</button>
                          <span className="ev-by"> · </span>
                        </>
                      )}
                      {timeLeft(ev.endsAt, now)} left
                      {ev.id.startsWith('u-') && (
                        <ReportButton
                          postId={ev.id.slice(2)}
                          authed={authed}
                          onNeedAccount={onNeedAccount}
                          className="ev-report"
                        />
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
                    <p className="rec-title">{p.title}{p.is_demo && <span className="demo-tag micro">Demo</span>}</p>
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

        <div className="spot-actions">
          <button className="btn-primary sheet-post" onClick={() => onPost(spot.id)}>Post from {spot.name}</button>
          <div className="spot-action-row">
            <a
              className="spot-action"
              href={`https://maps.apple.com/?daddr=${spot.coords[1]},${spot.coords[0]}&q=${encodeURIComponent(spot.name)}`}
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 14 8l-2 .6-.6 5.6L8 10.6 4.6 14.2 4 8.6 2 8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              Directions
            </a>
            <button className="spot-action" onClick={share}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.4M5.2 5.2 8 2.4l2.8 2.8M3 9.4v3.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Share
            </button>
          </div>
        </div>

        <RoomPanel
          spotId={spot.id}
          spotName={spot.name}
          me={me}
          onNeedAccount={onNeedAccount}
          onOpenProfile={onOpenProfile}
        />
      </section>
    </div>
  )
}
