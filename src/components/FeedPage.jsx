import { useEffect, useMemo, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { avatarHue, avatarInitial } from '../data/people.js'
import { supa } from '../lib/supa.js'
import { mid, dimsOf } from '../lib/img.js'
import { watchImpression } from '../lib/impressions.js'
import { isReported, onReportedChange } from '../lib/reported.js'
import ReportButton from './ReportButton.jsx'
import { StoppingLine } from './TonightPage.jsx'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

const dist = (a, b) => {
  const dx = (a[0] - b[0]) * 87700
  const dy = (a[1] - b[1]) * 111000
  return Math.hypot(dx, dy)
}

const timeAgo = (ts, now) => {
  const m = Math.max(1, Math.round((now - ts) / 60000))
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}

export default function FeedPage({ events, now, onOpenSpot, onOpenProfile, onOpenPlace, authed, onNeedAccount }) {
  const [, bumpReported] = useState(0)
  useEffect(() => onReportedChange(() => bumpReported((n) => n + 1)), [])
  const [dbPosts, setDbPosts] = useState([])
  const [sort, setSort] = useState('recent')
  const [here, setHere] = useState(null) // [lon, lat]
  const [geoErr, setGeoErr] = useState(false)

  useEffect(() => {
    supa.from('posts')
      .select('id, spot_id, title, created_at, expires_at, username, photo_path, mid_path, thumb_path, place_name, lat, lng, likes(user_id), comments(count)')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { if (data) setDbPosts(data) })
  }, [])

  const wantNearby = () => {
    if (sort === 'nearby') { setSort('recent'); return }
    if (here) { setSort('nearby'); return }
    if (!navigator.geolocation) { setGeoErr(true); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere([pos.coords.longitude, pos.coords.latitude]); setSort('nearby'); setGeoErr(false) },
      () => setGeoErr(true),
      { maximumAge: 300000, timeout: 8000 },
    )
  }

  const cards = useMemo(() => {
    const fromDb = dbPosts
      .filter((p) => bySpot[p.spot_id] || p.place_name)
      .map((p) => ({
        key: `db-${p.id}`,
        spotId: bySpot[p.spot_id] ? p.spot_id : null,
        place: p.place_name || null,
        coords: bySpot[p.spot_id]?.coords || (p.lng != null ? [p.lng, p.lat] : null),
        title: p.title,
        by: p.username,
        img: p.mid_path || p.photo_path || null,
        postId: p.id,
        when: Date.parse(p.created_at),
        live: Date.parse(p.expires_at) > now,
        likes: p.likes?.length || 0,
        comments: p.comments?.[0]?.count || 0,
      }))
    const seeded = events
      .filter((e) => !e.dying && !e.id.startsWith('u-') && bySpot[e.spotId])
      .map((e) => ({
        key: `seed-${e.id}`,
        demo: true,
        spotId: e.spotId,
        place: null,
        coords: bySpot[e.spotId].coords,
        title: e.title,
        by: e.by || null,
        img: EVENT_PHOTOS[e.id]?.src || spotPhoto(e.spotId)?.src || null,
        when: now - 30 * 60000, // seeded posts read as fresh
        live: true,
        likes: 0,
        comments: 0,
      }))
    const all = [...fromDb, ...seeded].filter((c) => !c.postId || !isReported(c.postId))
    if (sort === 'nearby' && here) {
      return all.filter((c) => c.coords).sort((a, b) => dist(a.coords, here) - dist(b.coords, here))
    }
    return all.sort((a, b) => (b.live - a.live) || (b.when - a.when))
  }, [dbPosts, events, sort, here, now])

  return (
    <section className="page" aria-label="Recent posts">
      <header className="page-head">
        <h2 className="page-title">The feed</h2>
        <div className="rec-sort feed-sort" role="radiogroup" aria-label="Sort feed">
          <button role="radio" aria-checked={sort === 'recent'} className={`rec-sort-btn ${sort === 'recent' ? 'on' : ''}`} onClick={() => setSort('recent')}>recent</button>
          <button role="radio" aria-checked={sort === 'nearby'} className={`rec-sort-btn ${sort === 'nearby' ? 'on' : ''}`} onClick={wantNearby}>nearby</button>
        </div>
      </header>
      {geoErr && <p className="micro feed-geo-err">Couldn’t get your location — showing recent instead.</p>}
      {sort === 'nearby' && here && <p className="micro feed-geo-ok">Closest to you first.</p>}

      {cards.length === 0 ? (
        <p className="empty-line">Nothing yet — the board is yours.</p>
      ) : (
        <div className="masonry">
          {cards.map((c) => {
            const spot = c.spotId ? bySpot[c.spotId] : null
            const cat = spot ? CATEGORIES[spot.cat] : CATEGORIES.niche
            const hue = c.by ? avatarHue(c.by) : null
            const open = () => spot
              ? onOpenSpot(c.spotId)
              : (c.coords && onOpenPlace?.({ lng: c.coords[0], lat: c.coords[1] }))
            return (
              <article
                key={c.key}
                className="mas-card"
                ref={(el) => c.postId && watchImpression(el, c.postId)}
                onClick={open}
              >
                {c.img
                  ? <img className="mas-img" src={mid(c.img)} width={dimsOf(c.img)?.[0]} height={dimsOf(c.img)?.[1]} alt="" loading="lazy" />
                  : (
                    <div className="mas-text" style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${cat.color} 18%, var(--card)), color-mix(in srgb, ${cat.deep} 30%, var(--card)))` }}>
                      <p>{c.title}</p>
                    </div>
                  )}
                {c.img && <p className="mas-title">{c.title}</p>}
                {c.demo && <span className="demo-tag micro">Demo</span>}
                <footer className="mas-meta">
                  {c.by && (
                    <button
                      className="mas-by"
                      onClick={(e) => { e.stopPropagation(); onOpenProfile(c.by) }}
                    >
                      <span className="mas-ava" style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}>{avatarInitial(c.by)}</span>
                      @{c.by}
                    </button>
                  )}
                  <span className="micro mas-when">
                    <span
                      className={`pill-dot ${c.live ? 'dot-live' : ''}`}
                      style={{ background: cat.color }}
                      aria-hidden="true"
                    />
                    <span className="mas-where">{spot?.name || c.place}</span>
                    {!c.live && <span className="mas-ago"> · {timeAgo(c.when, now)}</span>}
                    {c.live && <span className="sr-only"> — live now</span>}
                  </span>
                </footer>
                {c.postId && (
                  <ReportButton postId={c.postId} authed={authed} onNeedAccount={onNeedAccount} className="mas-report" />
                )}
                {(c.likes > 0 || c.comments > 0) && (
                  <p className="micro mas-counts">
                    {c.likes > 0 && `♥ ${c.likes}`}{c.likes > 0 && c.comments > 0 && '  ·  '}{c.comments > 0 && `💬 ${c.comments}`}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
      {cards.length > 0 && <StoppingLine now={now} />}
    </section>
  )
}
