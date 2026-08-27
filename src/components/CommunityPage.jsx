import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES, liveBusy } from '../data/spots.js'
import { spotPhoto } from '../data/photos.js'
import { mid } from '../lib/img.js'
import { supa } from '../lib/supa.js'
import { urlFor } from '../lib/router.js'
import { shareOrCopy } from '../lib/share.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

// A school's COMMUNITY — the people, not the place.
//
// The campus is a location: it sits on the map, it has an address, you can
// walk to it. The community is who is there, and the two want different pages.
// This is the second one, and it is deliberately owned by nobody: groups are
// claimable because a person really does run the film society, but the
// institution is not a group, so there is no claim flow, no owner column, and
// no name a student could take that would let them stand in for it.
export default function SchoolPage({ domain, now, onOpenSpot, onOpenOrg, onToast, onBack, verified }) {
  const [school, setSchool] = useState(undefined)
  const [orgs, setOrgs] = useState([])
  const [posts, setPosts] = useState([])
  const [myGroups, setMyGroups] = useState([])

  useEffect(() => {
    if (!domain) return
    let live = true
    supa.from('schools').select('domain, name, color, accent, lng, lat').eq('domain', domain).maybeSingle()
      .then(({ data }) => { if (live) setSchool(data) })
    // RLS returns only groups you are in, which is the whole point of them
    supa.from('groups').select('id, name, school_domain').eq('school_domain', domain)
      .then(({ data }) => { if (live) setMyGroups(data || []) })
    supa.from('orgs').select('id, handle, name, bio').eq('school_domain', domain).order('name')
      .then(({ data }) => {
        if (!live) return
        setOrgs(data || [])
        const ids = (data || []).map((o) => o.id)
        if (!ids.length) { setPosts([]); return }
        // RLS decides what comes back: campus-only posts appear for verified
        // students of this school and for nobody else, so this one query is
        // correct for both kinds of reader
        supa.from('posts')
          .select('id, spot_id, title, created_at, expires_at, thumb_path, mid_path, place_name, audience, username, org_id')
          .in('org_id', ids).order('created_at', { ascending: false }).limit(12)
          .then(({ data: rows }) => { if (live) setPosts(rows || []) })
      })
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
    title: `The ${school?.name || domain} community on hum.`,
    text: `Groups and places around ${school?.name || domain}`,
    url: urlFor({ view: 'community', handle: domain }),
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
                  <span className="org-tag micro">Community</span>
                  {mine && <span className="org-tag micro">You’re verified here</span>}
                </p>
                {/* said plainly, because the question comes up */}
                <p className="micro school-note">
                  The {school.name} community — the people, not the campus. It belongs to
                  nobody; the groups in it are run by students.
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
              <span className="prof-stat"><b>{orgs.length}</b><span className="micro">{orgs.length === 1 ? 'org' : 'orgs'}</span></span>
              <span className="prof-stat"><b>{posts.length}</b><span className="micro">on now</span></span>
              <span className="prof-stat"><b>{near.length}</b><span className="micro">spots nearby</span></span>
            </div>

            <p className="micro block-label">
              What’s on
              {mine && <span className="school-sub"> · including campus-only, because you’re verified here</span>}
            </p>
            {posts.length === 0 ? (
              <p className="empty-line">
                Nothing from these groups right now.
                {!mine && ' Verify your school address to see campus-only posts too.'}
              </p>
            ) : (
              <ul className="mod-list comm-posts">
                {posts.slice(0, 6).map((p) => {
                  const org = orgs.find((o) => o.id === p.org_id)
                  const live = Date.parse(p.expires_at) > now
                  return (
                    <li key={p.id}>
                      <button className="dm-thread" onClick={() => p.spot_id && onOpenSpot(p.spot_id)}>
                        <span className="dm-thread-text">
                          <span className="dm-thread-name">
                            {live && <span className="tp-live-dot" aria-hidden="true" />}
                            {p.title}
                          </span>
                          <span className="micro dm-snippet">
                            {org?.name || 'a group'}
                            {p.audience === 'school' && ' · campus only'}
                            {p.spot_id && ` · ${bySpot[p.spot_id]?.name || ''}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Orgs publish; groups converse. Calling both of them "groups"
                was the confusion — students already say "student org", and
                GroupMe already taught everyone what a group is. */}
            <p className="micro block-label">
              Student orgs
              <span className="school-sub"> · anyone can see these</span>
            </p>
            {orgs.length === 0 ? (
              <p className="empty-line">
                No student orgs yet. If you run one, claim it from your profile — it takes a review.
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

            {mine && (
              <>
                <p className="micro block-label">
                  Your groups
                  <span className="school-sub"> · private, and only you can see this list</span>
                </p>
                {myGroups.length === 0 ? (
                  <p className="empty-line">
                    You’re not in any groups here. They’re invite-only and never listed —
                    someone inside has to give you the code.
                  </p>
                ) : (
                  <ul className="mod-list school-orgs">
                    {myGroups.map((g) => (
                      <li key={g.id}>
                        <button className="dm-thread" onClick={onOpenGroups}>
                          <span className="room-ava org-ava-sm">{g.name[0]}</span>
                          <span className="dm-thread-text">
                            <span className="dm-thread-name">{g.name}</span>
                            <span className="micro dm-snippet">private group · open in Messages</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {/* the place, kept distinct from the people, and named as such */}
            <p className="micro block-label">Where this community goes</p>
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
