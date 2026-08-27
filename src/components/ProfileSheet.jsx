import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { personFor, avatarHue, computeBadges, profileStats } from '../data/people.js'
import { spotPhoto } from '../data/photos.js'
import { mid } from '../lib/img.js'

import { supa } from '../lib/supa.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function ProfileSheet({ username, events, now, onClose, onOpenSpot, onStory }) {
  const demo = personFor(username)
  const [dbProfile, setDbProfile] = useState(null)
  const [dbPosts, setDbPosts] = useState([])

  // real accounts: name + join date, and the durable posting record —
  // posts leave the map when they expire, but the profile remembers
  useEffect(() => {
    supa.from('profiles').select('username, full_name, created_at').eq('username', username).maybeSingle()
      .then(({ data }) => setDbProfile(data))
    supa.from('posts').select('id, spot_id, title, created_at, expires_at, thumb_path, mid_path, place_name, is_demo').eq('username', username)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setDbPosts(data || []))
  }, [username, demo])

  const active = events.filter((e) => e.by === username && !e.dying)
  const historyIds = demo
    ? [...demo.history, ...active.map((e) => e.spotId)]
    : dbPosts.map((p) => p.spot_id).filter(Boolean)
  const badges = computeBadges(historyIds)
  const stats = profileStats(historyIds)
  const name = demo?.name || dbProfile?.full_name || username
  const line = demo?.line || (dbProfile?.created_at
    ? `out. since ${new Date(dbProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase()}`
    : null)
  const hue = avatarHue(username)

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label={`@${username}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        <header className="prof-head">
          <button
            className={`prof-ava ${active.length ? 'prof-ava-story' : ''}`}
            style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}
            aria-label={active.length ? `Watch @${username}’s story` : `@${username}`}
            onClick={() => active.length && onStory(username)}
          >
            <span className="prof-initial">{name[0]}</span>
          </button>
          <div className="prof-id">
            <h2 className="sheet-name prof-name">{name}</h2>
            <p className="micro prof-user">@{username}{demo && <span className="demo-tag micro">Demo</span>}</p>
            {line && <p className="prof-line">“{line}”</p>}
          </div>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="prof-stats">
          <span><strong>{stats.posts}</strong> posts</span>
          <span><strong>{stats.spots}</strong> spots</span>
          {active.length > 0 && (
            <button className="prof-live" onClick={() => onStory(username)}>
              <span className="prof-story-dot" aria-hidden="true" />
              {active.length} live
            </button>
          )}
        </div>

        {badges.length > 0 && (
          <>
            <ul className="prof-badges">
              {badges.map((b) => (
                <li key={b.label} style={{ '--badge': b.color, '--badge-deep': b.deep }}>
                  <span className="pill-dot" style={{ background: b.color }} aria-hidden="true" />
                  {b.label}
                </li>
              ))}
            </ul>
          </>
        )}

        {(() => {
          // One grid, the way a profile reads everywhere else: newest first,
          // live posts marked, photos where they exist and the words themselves
          // where they don't.
          const tiles = [
            ...active.map((e) => ({
              key: e.id, live: true, title: e.title, spotId: e.spotId,
              img: e.img || (e.spotId ? spotPhoto(e.spotId)?.src : null),
              demo: !e.id.startsWith('u-') || e.demo, place: e.place,
            })),
            ...dbPosts
              .filter((d) => Date.parse(d.expires_at) <= now)
              .map((d) => ({
                key: d.id, live: false, title: d.title, spotId: d.spot_id,
                img: d.mid_path || d.thumb_path || (bySpot[d.spot_id] ? spotPhoto(d.spot_id)?.src : null),
                demo: d.is_demo, place: d.place_name,
              })),
          ]
          if (!tiles.length) {
            return <p className="micro block-label">Nothing on the map right now</p>
          }
          return (
            <ul className="prof-grid">
              {tiles.slice(0, 18).map((t) => {
                const spot = t.spotId ? bySpot[t.spotId] : null
                const cat = CATEGORIES[spot?.cat || 'niche']
                return (
                  <li key={t.key}>
                    <button
                      className="prof-tile"
                      onClick={() => spot && onOpenSpot(t.spotId)}
                      aria-label={`${t.title} — ${spot?.name || t.place || 'out there'}`}
                    >
                      {t.img
                        ? <img src={mid(t.img)} alt="" loading="lazy" />
                        : (
                          <span
                            className="prof-tile-text"
                            style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${cat.color} 20%, var(--card)), color-mix(in srgb, ${cat.deep} 34%, var(--card)))` }}
                          >
                            {t.title}
                          </span>
                        )}
                      {t.live && <span className="prof-tile-live" aria-label="live now" />}
                      {t.demo && <span className="prof-tile-demo micro">Demo</span>}
                      <span className="prof-tile-where micro">{spot?.name || t.place || 'out there'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        })()}


        {demo ? (
          <p className="micro prof-foot">Their haunts: {[...new Set(demo.history)].slice(0, 5).map((id) => bySpot[id]?.name).filter(Boolean).join(' · ')}</p>
        ) : (
          <p className="micro prof-foot">Badges grow from where they post — posts expire, badges stay.</p>
        )}
      </section>
    </div>
  )
}
