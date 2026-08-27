import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { spotPhoto } from '../data/photos.js'
import { mid } from '../lib/img.js'
import { supa } from '../lib/supa.js'
import { urlFor } from '../lib/router.js'
import { shareOrCopy } from '../lib/share.js'
import HauntsMap from './HauntsMap.jsx'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

// A group's page. Deliberately the same furniture as a person's — the map of
// where they turn up, the grid of what they've put on — because a group is
// another thing you might follow around the city, not a different species.
// What it does not have: badges, a story ring, a personal handle. A group
// hosts; it does not wander, and it is not a someone.
export default function OrgPage({ handle, now, onOpenSpot, onOpenSchool, onToast, onBack, member }) {
  const [org, setOrg] = useState(undefined) // undefined = still asking
  const [posts, setPosts] = useState([])

  useEffect(() => {
    if (!handle) return
    let live = true
    supa.from('orgs').select('id, handle, name, school_domain, bio, claimed_at')
      .eq('handle', handle).maybeSingle()
      .then(({ data }) => {
        if (!live) return
        setOrg(data)
        if (!data) return
        supa.from('posts')
          .select('id, spot_id, title, created_at, expires_at, thumb_path, mid_path, place_name, is_demo, audience')
          .eq('org_id', data.id).order('created_at', { ascending: false }).limit(30)
          .then(({ data: rows }) => { if (live) setPosts(rows || []) })
      })
    return () => { live = false }
  }, [handle])

  const historyIds = posts.map((p) => p.spot_id).filter(Boolean)
  const spots = new Set(historyIds)

  const share = () => shareOrCopy({
    title: `${org?.name || handle} on out.`,
    text: org?.bio ? `${org.name} — ${org.bio}` : `${org?.name || handle} on out.`,
    url: urlFor({ view: 'org', handle }),
  }, onToast)

  return (
    <section className="page profile-page" aria-label={org?.name || handle}>
      <div className="page-inner">
        <div className="prof-topline">
          <button className="prof-back" onClick={onBack} aria-label="Back">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {org === null ? (
          <p className="empty-line">No group here by that name.</p>
        ) : org === undefined ? null : (
          <>
            <header className="prof-head">
              <span className="prof-ava org-ava" aria-hidden="true">
                <span className="prof-initial">{org.name[0]}</span>
              </span>
              <div className="prof-id">
                <h2 className="page-title prof-name">{org.name}</h2>
                <p className="micro prof-user">
                  @{org.handle}
                  <span className="org-tag micro">Student org</span>
                  {member && <span className="org-tag micro">You’re in this</span>}
                </p>
                <button className="micro prof-school prof-school-link" onClick={() => onOpenSchool?.(org.school_domain)}>
                  {org.school_domain}
                </button>
                {org.bio && <p className="prof-line">{org.bio}</p>}
              </div>
            </header>

            <div className="prof-actions">
              <button className="prof-share" onClick={share}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.4M5.2 5.2 8 2.4l2.8 2.8M3 9.4v3.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Share
              </button>
            </div>

            <div className="prof-stats">
              <span className="prof-stat"><b>{posts.length}</b><span className="micro">events</span></span>
              <span className="prof-stat"><b>{spots.size}</b><span className="micro">spots</span></span>
            </div>

            {historyIds.length > 0 && (
              <>
                <p className="micro block-label">Where they host</p>
                <HauntsMap spotIds={historyIds} />
              </>
            )}

            {posts.length > 0 ? (
              <ul className="prof-grid">
                {posts.slice(0, 18).map((p) => {
                  const spot = p.spot_id ? bySpot[p.spot_id] : null
                  const cat = CATEGORIES[spot?.cat || 'niche']
                  const img = p.mid_path || p.thumb_path || (spot ? spotPhoto(p.spot_id)?.src : null)
                  const live = Date.parse(p.expires_at) > now
                  return (
                    <li key={p.id}>
                      <button
                        className="prof-tile"
                        onClick={() => spot && onOpenSpot(p.spot_id)}
                        aria-label={`${p.title} — ${spot?.name || p.place_name || 'out there'}`}
                      >
                        {img
                          ? <img src={mid(img)} alt="" loading="lazy" />
                          : (
                            <span
                              className="prof-tile-text"
                              style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${cat.color} 20%, var(--card)), color-mix(in srgb, ${cat.deep} 34%, var(--card)))` }}
                            >
                              {p.title}
                            </span>
                          )}
                        {live && <span className="prof-tile-live" aria-label="on now" />}
                        {p.audience === 'school' && <span className="prof-tile-campus micro">Campus</span>}
                        {p.is_demo && <span className="prof-tile-demo micro">Demo</span>}
                        <span className="prof-tile-where micro">{spot?.name || p.place_name || 'out there'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-line">Nothing on the map from them yet.</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
