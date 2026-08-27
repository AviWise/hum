import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES, liveBusy } from '../data/spots.js'
import { spotPhoto } from '../data/photos.js'
import { mid } from '../lib/img.js'
import { supa } from '../lib/supa.js'
import { urlFor } from '../lib/router.js'
import { shareOrCopy } from '../lib/share.js'

// A university's page. Deliberately owned by nobody.
//
// Groups are claimable because a person really does run the film society. The
// institution is not a group — it is the place all of them are at, closer to a
// spot on the map than to an account — so there is no claim flow, no owner
// column, and no name a student could take that would let them stand in for
// it. What it holds is other people's things: the groups here, and the city
// nearest the campus.
export default function SchoolPage({ domain, now, onOpenSpot, onOpenOrg, onToast, onBack, verified }) {
  const [school, setSchool] = useState(undefined)
  const [orgs, setOrgs] = useState([])

  useEffect(() => {
    if (!domain) return
    let live = true
    supa.from('schools').select('domain, name, color, accent, lng, lat').eq('domain', domain).maybeSingle()
      .then(({ data }) => { if (live) setSchool(data) })
    supa.from('orgs').select('id, handle, name, bio').eq('school_domain', domain).order('name')
      .then(({ data }) => { if (live) setOrgs(data || []) })
    return () => { live = false }
  }, [domain])

  // the city nearest the campus, so the page answers "where do people go from
  // here" rather than listing the university back at itself
  const near = school?.lng == null ? [] : [...SPOTS]
    .map((s) => ({ s, d: Math.hypot(s.coords[0] - school.lng, s.coords[1] - school.lat) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 8)
    .map((x) => x.s)

  const mine = verified?.domain === domain

  const share = () => shareOrCopy({
    title: `${school?.name || domain} on out.`,
    text: `Groups and places around ${school?.name || domain}`,
    url: urlFor({ view: 'school', handle: domain }),
  }, onToast)

  return (
    <section className="page profile-page" aria-label={school?.name || domain}>
      <div className="page-inner">
        <div className="prof-topline">
          <button className="prof-back" onClick={onBack} aria-label="Back">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        {school === null ? (
          <p className="empty-line">No school here by that name.</p>
        ) : school === undefined ? null : (
          <>
            <header className="prof-head">
              <span
                className="school-mark school-mark-huge"
                style={{ '--c': school.color || 'var(--plum)', '--a': school.accent || 'var(--ink-soft)' }}
                aria-hidden="true"
              />
              <div className="prof-id">
                <h2 className="page-title prof-name">{school.name}</h2>
                <p className="micro prof-user">
                  {school.domain}
                  {mine && <span className="org-tag micro">You’re verified here</span>}
                </p>
                {/* said plainly, because the question comes up */}
                <p className="micro school-note">
                  A university page belongs to nobody. Groups here are run by students.
                </p>
              </div>
            </header>

            <div className="prof-actions">
              <button className="prof-share" onClick={share}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.4M5.2 5.2 8 2.4l2.8 2.8M3 9.4v3.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Share
              </button>
            </div>

            <div className="prof-stats">
              <span className="prof-stat"><b>{orgs.length}</b><span className="micro">{orgs.length === 1 ? 'group' : 'groups'}</span></span>
              <span className="prof-stat"><b>{near.length}</b><span className="micro">spots nearby</span></span>
            </div>

            <p className="micro block-label">Groups here</p>
            {orgs.length === 0 ? (
              <p className="empty-line">
                No groups yet. If you run one, claim it from your profile — it takes a review.
              </p>
            ) : (
              <ul className="mod-list school-orgs">
                {orgs.map((o) => (
                  <li key={o.id}>
                    <button className="dm-thread" onClick={() => onOpenOrg(o.handle)}>
                      <span className="room-ava org-ava-sm">{o.name[0]}</span>
                      <span className="dm-thread-text">
                        <span className="dm-thread-name">{o.name}</span>
                        <span className="micro dm-snippet">@{o.handle}{o.bio ? ` · ${o.bio}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="micro block-label">Around campus</p>
            <ul className="prof-grid">
              {near.map((s) => {
                const cat = CATEGORIES[s.cat]
                const img = spotPhoto(s.id)?.src
                return (
                  <li key={s.id}>
                    <button className="prof-tile" onClick={() => onOpenSpot(s.id)} aria-label={s.name}>
                      {img
                        ? <img src={mid(img)} alt="" loading="lazy" />
                        : (
                          <span
                            className="prof-tile-text"
                            style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${cat.color} 20%, var(--card)), color-mix(in srgb, ${cat.deep} 34%, var(--card)))` }}
                          >
                            {s.name}
                          </span>
                        )}
                      <span className="prof-tile-where micro">
                        {s.name} · {liveBusy(s, now) >= 55 ? 'busy' : 'quiet'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
