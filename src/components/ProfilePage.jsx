import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { personFor, avatarHue, avatarInitial, computeBadges, profileStats } from '../data/people.js'
import { spotPhoto } from '../data/photos.js'
import { mid } from '../lib/img.js'
import { supa } from '../lib/supa.js'
import { urlFor, go } from '../lib/router.js'
import { shareOrCopy } from '../lib/share.js'
import { isUnseen, markSeen } from '../lib/seen.js'
import { enablePush, pushState } from '../lib/push.js'
import HauntsMap from './HauntsMap.jsx'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function ProfilePage({ username, events, now, onOpenSpot, onStory, onToast, onBack, onClaimOrg, onVerifySchool, onMessage, verified, isMe }) {
  const demo = personFor(username)
  const [dbProfile, setDbProfile] = useState(null)
  const [dbPosts, setDbPosts] = useState([])

  useEffect(() => {
    if (!username) return
    supa.from('profiles').select('id, username, full_name, created_at, kind, school_domain, bio').eq('username', username).maybeSingle()
      .then(({ data }) => {
        setDbProfile(data)
        // Bylines come from five different places and a group's byline is its
        // handle, so rather than thread "is this a group?" through all of them,
        // a person route that finds no person asks whether it's a group and
        // hands over. Live events carry no org flag at all; this covers them too.
        if (!data) {
          supa.from('orgs').select('handle').eq('handle', username).maybeSingle()
            .then(({ data: org }) => { if (org) go({ view: 'org', handle: org.handle }, { replace: true }) })
        }
      })
    supa.from('posts').select('id, spot_id, title, created_at, expires_at, thumb_path, mid_path, place_name, is_demo, audience')
      .eq('username', username).order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setDbPosts(data || []))
  }, [username])

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
  const hue = avatarHue(username || '?')
  // the ring means "there is something here you haven't watched" — otherwise
  // it is just a circle around everyone who has ever posted
  const storyStamp = active.reduce((m, e) => Math.max(m, e.endsAt || 0), 0)
  const [unseen, setUnseen] = useState(false)
  const [push, setPush] = useState(null)
  useEffect(() => { if (isMe) pushState().then(setPush) }, [isMe])
  useEffect(() => { setUnseen(isUnseen(username, storyStamp)) }, [username, storyStamp])
  const notFound = !demo && dbProfile === null && dbPosts.length === 0
  // An org is the same profile with a different kind — same page, same posts
  // grid, same map. What changes is what the numbers mean: a group hosts, it
  // does not wander, so it gets no badges for where it has been.
  const isOrg = (demo?.kind || dbProfile?.kind) === 'org'
  const school = demo?.school || dbProfile?.school_domain || null

  const tiles = [
    ...active.map((e) => ({
      key: e.id, live: true, title: e.title, spotId: e.spotId,
      img: e.img || (e.spotId ? spotPhoto(e.spotId)?.src : null),
      demo: !e.id.startsWith('u-') || e.demo, place: e.place,
    })),
    ...dbPosts.filter((d) => Date.parse(d.expires_at) <= now).map((d) => ({
      key: d.id, live: false, title: d.title, spotId: d.spot_id,
      img: d.mid_path || d.thumb_path || (bySpot[d.spot_id] ? spotPhoto(d.spot_id)?.src : null),
      demo: d.is_demo, place: d.place_name, campus: d.audience === 'school',
    })),
  ]

  const share = () => shareOrCopy({
    title: `@${username} on out.`,
    text: line ? `@${username} — ${line}` : `@${username} on out.`,
    url: urlFor({ view: 'profile', handle: username }),
  }, onToast)

  return (
    <section className="page profile-page" aria-label={`@${username}`}>
      <div className="page-inner">
        <div className="prof-topline">
          <button className="prof-back" onClick={onBack} aria-label="Back">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {!isMe && !demo && dbProfile?.id && (
            <button className="prof-share prof-msg" onClick={() => onMessage?.({ id: dbProfile.id, username: dbProfile.username, full_name: dbProfile.full_name })}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="3.4" width="12.4" height="9.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2.4 4.6 8 8.8l5.6-4.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Message
            </button>
          )}
          <button className="prof-share" onClick={share}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.4M5.2 5.2 8 2.4l2.8 2.8M3 9.4v3.4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Share
          </button>
        </div>

        {notFound ? (
          <p className="empty-line">No one here by that name.</p>
        ) : (
          <>
            <header className="prof-head">
              <button
                className={`prof-ava ${active.length ? (unseen ? 'prof-ava-story' : 'prof-ava-seen') : ''}`}
                style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}
                aria-label={active.length ? `${unseen ? 'Watch' : 'Watch again'} @${username}’s story` : `@${username}`}
                onClick={() => {
                  if (!active.length) return
                  markSeen(username, storyStamp)
                  setUnseen(false)
                  onStory(username)
                }}
              >
                <span className="prof-initial">{demo ? name[0] : avatarInitial(username)}</span>
              </button>
              <div className="prof-id">
                <h2 className="page-title prof-name">{name}</h2>
                <p className="micro prof-user">
                  @{username}
                  {isOrg && <span className="org-tag micro">Student org</span>}
                  {demo && <span className="demo-tag micro">Demo</span>}
                </p>
                {isOrg && school && <p className="micro prof-school">{school}</p>}
                {line && <p className="prof-line">{isOrg ? line : `“${line}”`}</p>}
              </div>
            </header>

            <div className="prof-stats">
              <span className="prof-stat"><b>{stats.posts}</b><span className="micro">{isOrg ? 'events' : 'posts'}</span></span>
              <span className="prof-stat"><b>{stats.spots}</b><span className="micro">spots</span></span>
              {!isOrg && <span className="prof-stat"><b>{badges.length}</b><span className="micro">badges</span></span>}
              {active.length > 0 && (
                <button className="prof-live" onClick={() => onStory(username)}>
                  <span className="prof-story-dot" aria-hidden="true" />
                  {active.length} live now
                </button>
              )}
            </div>

            {!isOrg && badges.length > 0 && (
              <ul className="prof-badges">
                {badges.map((b) => (
                  <li key={b.label} style={{ '--badge': b.color, '--badge-deep': b.deep }}>
                    <span className="pill-dot" style={{ background: b.color }} aria-hidden="true" />
                    {b.label}
                  </li>
                ))}
              </ul>
            )}

            {historyIds.length > 0 && (
              <>
                <p className="micro block-label">{isOrg ? 'Where they host' : 'Where they go'}</p>
                <HauntsMap spotIds={historyIds} />
              </>
            )}

            {/* the shelf exists so crowns have somewhere to land later; it draws
                nothing until there is something true to put on it */}
            {false && <div className="prof-trophies" />}

            {tiles.length > 0 ? (
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
                        {t.campus && <span className="prof-tile-campus micro">Campus</span>}
                        {t.demo && <span className="prof-tile-demo micro">Demo</span>}
                        <span className="prof-tile-where micro">{spot?.name || t.place || 'out there'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-line">{isMe ? 'Nothing posted yet — the map is waiting.' : 'Nothing on the map right now.'}</p>
            )}

            {isMe && (verified ? (
              <p className="verified-line">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Verified at {verified.domain} — you see campus posts from groups there
              </p>
            ) : (
              <button type="button" className="org-claim-cta" onClick={onVerifySchool}>
                <span>Go to school here?</span>
                <span className="micro">Verify a school email to see campus-only posts</span>
              </button>
            ))}

            {isMe && push && push !== 'unsupported' && (
              push === 'on' ? (
                <p className="verified-line">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  We’ll tell you when the city’s worth it — once a day at most
                </p>
              ) : (
                <button
                  type="button"
                  className="org-claim-cta"
                  disabled={push === 'denied' || push === 'ios-install'}
                  onClick={async () => {
                    const r = await enablePush()
                    setPush(await pushState())
                    if (r.ok) onToast?.('We’ll only buzz you when something’s on')
                  }}
                >
                  <span>Tell me when it’s worth going out</span>
                  <span className="micro">
                    {push === 'denied'
                      ? 'Notifications are blocked for out. in your browser settings'
                      : push === 'ios-install'
                        ? 'On iPhone, add out. to your home screen first — then this works'
                        : 'Once a day at most, never after 10:30pm, and only when something’s actually on'}
                  </span>
                </button>
              )
            )}

            {isMe && !isOrg && (
              <button type="button" className="org-claim-cta" onClick={onClaimOrg}>
                <span>Run a student org?</span>
                <span className="micro">Claim it and post as the group</span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
