import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { personFor, avatarHue, computeBadges, profileStats } from '../data/people.js'
import { timeLeft } from '../lib/time.js'
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

        {active.length === 0 && <p className="micro block-label">Nothing on the map right now</p>}
        {active.length > 0 && (
          <ul className="sheet-events">
            {active.map((ev) => (
              <li key={ev.id}>
                <div className="sheet-ev-body">
                  <p className="sheet-ev-title">{ev.title}</p>
                  <p className="micro countdown">
                    <button className="prof-spot-link" onClick={() => onOpenSpot(ev.spotId)}>{bySpot[ev.spotId]?.name}</button>
                    {' '}· {timeLeft(ev.endsAt, now)} left
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {dbPosts.filter((p) => Date.parse(p.expires_at) <= now).length > 0 && (
          <>
            <p className="micro block-label">Recently</p>
            <ul className="prof-recents">
              {dbPosts.filter((p) => Date.parse(p.expires_at) <= now).slice(0, 8).map((p) => (
                <li key={p.id}>
                  {(p.thumb_path || p.mid_path) && <img className="prof-rec-thumb" src={p.thumb_path || p.mid_path} alt="" loading="lazy" />}
                  <div>
                    <p className="sheet-ev-title">{p.title}{p.is_demo && <span className="demo-tag micro">Demo</span>}</p>
                    <p className="micro countdown">
                      {bySpot[p.spot_id]
                        ? <button className="prof-spot-link" onClick={() => onOpenSpot(p.spot_id)}>{bySpot[p.spot_id].name}</button>
                        : <span>{p.place_name || 'out there'}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {demo ? (
          <p className="micro prof-foot">Their haunts: {[...new Set(demo.history)].slice(0, 5).map((id) => bySpot[id]?.name).filter(Boolean).join(' · ')}</p>
        ) : (
          <p className="micro prof-foot">Badges grow from where they post — posts expire, badges stay.</p>
        )}
      </section>
    </div>
  )
}
