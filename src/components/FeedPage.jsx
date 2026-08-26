import { useEffect, useMemo, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { avatarHue } from '../data/people.js'
import { supa } from '../lib/supa.js'

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

export default function FeedPage({ events, now, onOpenSpot, onOpenProfile }) {
  const [dbPosts, setDbPosts] = useState([])
  const [sort, setSort] = useState('recent')
  const [here, setHere] = useState(null) // [lon, lat]
  const [geoErr, setGeoErr] = useState(false)

  useEffect(() => {
    supa.from('posts')
      .select('id, spot_id, title, created_at, expires_at, username, photo_url, likes(user_id), comments(count)')
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
      .filter((p) => bySpot[p.spot_id])
      .map((p) => ({
        key: `db-${p.id}`,
        spotId: p.spot_id,
        title: p.title,
        by: p.username,
        img: p.photo_url || null,
        when: Date.parse(p.created_at),
        live: Date.parse(p.expires_at) > now,
        likes: p.likes?.length || 0,
        comments: p.comments?.[0]?.count || 0,
      }))
    const seeded = events
      .filter((e) => !e.dying && !e.id.startsWith('u-') && bySpot[e.spotId])
      .map((e) => ({
        key: `seed-${e.id}`,
        spotId: e.spotId,
        title: e.title,
        by: e.by || null,
        img: EVENT_PHOTOS[e.id]?.src || spotPhoto(e.spotId)?.src || null,
        when: now - 30 * 60000, // seeded posts read as fresh
        live: true,
        likes: 0,
        comments: 0,
      }))
    const all = [...fromDb, ...seeded]
    if (sort === 'nearby' && here) {
      return all.sort((a, b) => dist(bySpot[a.spotId].coords, here) - dist(bySpot[b.spotId].coords, here))
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
            const spot = bySpot[c.spotId]
            const cat = CATEGORIES[spot.cat]
            const hue = c.by ? avatarHue(c.by) : null
            return (
              <article key={c.key} className="mas-card" onClick={() => onOpenSpot(c.spotId)}>
                {c.img
                  ? <img className="mas-img" src={c.img} alt="" loading="lazy" />
                  : (
                    <div className="mas-text" style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${cat.color} 18%, var(--card)), color-mix(in srgb, ${cat.deep} 30%, var(--card)))` }}>
                      <p>{c.title}</p>
                    </div>
                  )}
                {c.img && <p className="mas-title">{c.title}</p>}
                <footer className="mas-meta">
                  {c.by && (
                    <button
                      className="mas-by"
                      onClick={(e) => { e.stopPropagation(); onOpenProfile(c.by) }}
                    >
                      <span className="mas-ava" style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}>{c.by[0]}</span>
                      @{c.by}
                    </button>
                  )}
                  <span className="micro mas-when">
                    <span className="pill-dot" style={{ background: cat.color }} aria-hidden="true" />
                    {spot.name}{c.live ? ' · live' : ` · ${timeAgo(c.when, now)}`}
                  </span>
                </footer>
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
    </section>
  )
}
