import { useEffect, useMemo, useRef, useState } from 'react'
import CityMap from './components/CityMap.jsx'
import SpotSheet from './components/SpotSheet.jsx'
import { RightNow } from './components/Tonight.jsx'
import TabBar from './components/TabBar.jsx'
import TonightPage from './components/TonightPage.jsx'
import FeedPage from './components/FeedPage.jsx'
import PostSheet from './components/PostSheet.jsx'
import TrainSheet from './components/TrainSheet.jsx'
import AccountSheet from './components/AccountSheet.jsx'
import SearchSheet from './components/SearchSheet.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import OrgClaimSheet from './components/OrgClaimSheet.jsx'
import OrgPage from './components/OrgPage.jsx'
import MessagesSheet from './components/MessagesSheet.jsx'
import AgeGateSheet from './components/AgeGateSheet.jsx'
import SchoolVerifySheet from './components/SchoolVerifySheet.jsx'
import StoryViewer from './components/StoryViewer.jsx'
import { attachAuthor } from './data/people.js'
import { SPOTS, CATEGORIES, seedEvents, liveBusy, crowdWord } from './data/spots.js'
import { clockLine } from './lib/time.js'
import { supa } from './lib/supa.js'
import { uploadPostPhoto } from './lib/upload.js'
import { setImpressionViewer } from './lib/impressions.js'
import { isReported, onReportedChange } from './lib/reported.js'
import { thumb } from './lib/img.js'
import { useRoute, go, parseHash, slugify, rememberScroll, recallScroll } from './lib/router.js'
import { spotPhoto } from './data/photos.js'
import { artUrl } from './components/markerArt.js'

const ALL_CATS = Object.keys(CATEGORIES)

export default function App() {
  const [now, setNow] = useState(() => Date.now())
  const [events, setEvents] = useState(() => seedEvents(Date.now()).map(attachAuthor))
  const [activeCats, setActiveCats] = useState(() => new Set(ALL_CATS))
  const [selected, setSelected] = useState(null)
  const [postFor, setPostFor] = useState(false) // false | null (any spot) | spotId
  const [metroOn, setMetroOn] = useState(() => {
    try { return localStorage.getItem('out.metro') === 'on' } catch { return false }
  })
  const idRef = useRef(100)

  const [rightNowOpen, setRightNowOpen] = useState(false)
  const [crowdsOpen, setCrowdsOpen] = useState(false) // mobile: slider folds under the legend pill
  // Thu–Sat after 6pm the app opens on the answer, not the whole city.
  const [opener, setOpener] = useState(() => {
    const d = new Date()
    return d.getDay() >= 4 && d.getDay() <= 6 && d.getHours() >= 18
  })
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [acctOpen, setAcctOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const route = useRoute()
  const tab = route.view === 'profile' || route.view === 'me' ? 'you'
    : route.view === 'spot' ? 'map'
    : route.view
  const setTab = (v) => go({ view: v === 'you' ? 'me' : v })
  const [storyFor, setStoryFor] = useState(null) // username whose story is playing
  const [authIntent, setAuthIntent] = useState(false) // false = just browsing; { spotId, place } = wants to post
  const [placeFor, setPlaceFor] = useState(null) // field post target: { name, lat, lng }
  const [flyPlace, setFlyPlace] = useState(null)
  const [dropAt, setDropAt] = useState(null) // { spotId, at } — the pin-drop moment
  const [dropChip, setDropChip] = useState(null) // badge progress after a post
  const [sinceLine, setSinceLine] = useState(null) // what changed while they were away
  // weekend-night opening frame: centre on the busiest place, once
  const framedRef = useRef(false)
  useEffect(() => {
    if (!opener || framedRef.current) return
    const top = [...SPOTS].sort((a, b) => liveBusy(b, Date.now()) - liveBusy(a, Date.now()))[0]
    if (!top) return
    framedRef.current = true
    setFlyPlace({ lng: top.coords[0], lat: top.coords[1], at: Date.now() })
  }, [opener])
  const [viewTime, setViewTime] = useState(null) // null = live now; a ts = scrubbed
  const [trainSel, setTrainSel] = useState(null)
  const toggleMetro = () => setMetroOn((v) => {
    try { localStorage.setItem('out.metro', v ? 'off' : 'on') } catch { /* private mode */ }
    return !v
  })

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // auth errors are never silent: surface OAuth failures once, then clean the URL
  const [toast, setToast] = useState(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [dmWith, setDmWith] = useState(null) // { id, username, full_name }
  const [ageOpen, setAgeOpen] = useState(false)
  const [adult, setAdult] = useState(null) // null = not asked yet
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verified, setVerified] = useState(null) // { domain } once they've proved their school
  const [myOrgs, setMyOrgs] = useState([]) // groups this account may post as
  useEffect(() => {
    const search = new URLSearchParams(location.search)
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
    const err = search.get('error') || hash.get('error')
    if (err) {
      setToast('Google sign-in didn’t finish. Try again, or use email.')
      history.replaceState(null, '', import.meta.env.BASE_URL)
      return
    }
    // deep link: /?spot=admo opens straight into that spot's sheet
    const deep = search.get('spot')
    if (deep && SPOTS.some((s) => s.id === deep)) {
      setSelected(deep)
      history.replaceState(null, '', import.meta.env.BASE_URL)
    }
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // What changed since last visit — real posts only, and only when it's worth
  // saying. Stamped at open so the next visit can compare.
  useEffect(() => {
    let last = null
    try { last = Number(localStorage.getItem('out.lastOpen')) || null } catch { /* private mode */ }
    const stamp = () => { try { localStorage.setItem('out.lastOpen', String(Date.now())) } catch { /* private mode */ } }
    if (!last || Date.now() - last < 20 * 60 * 1000) { stamp(); return }
    supa.from('posts')
      .select('created_at, expires_at')
      .gt('created_at', new Date(last).toISOString())
      .then(({ data }) => {
        const fresh = data?.length || 0
        supa.from('posts')
          .select('expires_at')
          .gt('expires_at', new Date(last).toISOString())
          .lt('expires_at', new Date().toISOString())
          .then(({ data: gone }) => {
            const expired = gone?.length || 0
            if (fresh + expired === 0) return
            const at = new Date(last).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            const bits = []
            if (fresh) bits.push(`${fresh} new since ${at}`)
            if (expired) bits.push(`${expired} expired`)
            setSinceLine(bits.join(' · '))
          })
      })
    stamp()
  }, [])
  useEffect(() => {
    supa.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supa.auth.onAuthStateChange((_ev, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => { setImpressionViewer(session?.user?.id || null) }, [session?.user?.id])
  useEffect(() => {
    if (!session) { setProfile(null); setVerified(null); setMyOrgs([]); setAdult(null); return }
    supa.from('profiles').select('username, kind, school_domain').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data))
    // what campus posts they're allowed to see; RLS decides, this only labels
    supa.from('school_verifications').select('domain, expires_at').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setVerified(data && (!data.expires_at || Date.parse(data.expires_at) > Date.now()) ? data : null))
    // the groups they can speak for. org_members is readable only by members,
    // so this returns exactly what they're allowed to post as.
    supa.from('org_members').select('role, orgs(id, handle, name, school_domain)')
      .eq('user_id', session.user.id)
      .then(({ data }) => setMyOrgs((data || []).map((r) => ({ ...r.orgs, role: r.role })).filter((o) => o.id)))
    // age_checks is readable only by its owner, so this is their own row or nothing
    supa.from('age_checks').select('birth_date').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) { setAdult(null); return }
        const b = new Date(data.birth_date)
        setAdult(new Date(b.getFullYear() + 18, b.getMonth(), b.getDate()) <= new Date())
      })
  }, [session?.user?.id])

  const wantPost = (spotId, place = null) => {
    if (session) { setPlaceFor(place); setPostFor(place ? null : spotId) }
    else { setAuthIntent({ spotId, place }); setAcctOpen(true) }
  }

  // shared posts: load what's live, then follow inserts in realtime
  useEffect(() => {
    const toEvent = (r) => ({ id: `u-${r.id}`, spotId: r.spot_id, title: r.title, endsAt: Date.parse(r.expires_at), photo: null, img: r.mid_path || r.photo_path || null, thumb: r.thumb_path || null, postId: r.id, by: r.username || null, demo: r.is_demo === true, place: r.place_name || null, lat: r.lat, lng: r.lng })
    supa
      .from('posts')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (error || !data) return
        setEvents((evs) => {
          const known = new Set(evs.map((e) => e.id))
          return [...data.map(toEvent).filter((e) => !known.has(e.id)), ...evs]
        })
      })
    const chan = supa
      .channel('posts-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const ev = toEvent(payload.new)
        setEvents((evs) => (evs.some((e) => e.id === ev.id) ? evs : [ev, ...evs]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        if (payload.new?.hidden) setEvents((evs) => evs.filter((e) => e.id !== `u-${payload.new.id}`))
      })
      .subscribe()
    return () => { supa.removeChannel(chan) }
  }, [])

  // Expiry: mark dying, then drop after the exit animation.
  useEffect(() => {
    const dead = events.filter((e) => !e.dying && e.endsAt <= now)
    if (dead.length) {
      setEvents((evs) => evs.map((e) => (e.endsAt <= now ? { ...e, dying: true } : e)))
      setTimeout(() => setEvents((evs) => evs.filter((e) => !(e.endsAt <= Date.now() - 900))), 950)
    }
  }, [now, events])

  const toggleCat = (id) => {
    setActiveCats((prev) => {
      if (id === 'all') return new Set(ALL_CATS)
      if (prev.size === ALL_CATS.length) return new Set([id]) // from "all", focus one
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      // deselecting everything (or selecting everything) settles back on All
      if (next.size === 0 || next.size === ALL_CATS.length) return new Set(ALL_CATS)
      return next
    })
  }

  const liveEvents = useMemo(
    () => [...events].sort((a, b) => a.endsAt - b.endsAt),
    [events],
  )
  const eventCounts = useMemo(() => {
    const c = {}
    for (const e of events) if (!e.dying && e.spotId) c[e.spotId] = (c[e.spotId] || 0) + 1
    return c
  }, [events])
  const fieldPosts = useMemo(
    () => events.filter((e) => !e.dying && !e.spotId && e.place && e.lat != null),
    [events],
  )

  // #/spot/<slug> is the addressable form of "sheet open on this spot".
  // Leaving the route closes the sheet, so backing out of a spot actually
  // leaves it rather than dragging it onto the next screen.
  useEffect(() => {
    if (route.view === 'spot') {
      const hit = SPOTS.find((s) => slugify(s.name) === route.slug || s.id === route.slug)
      if (hit) {
        setSelected(hit.id)
        setFlyPlace({ lng: hit.coords[0], lat: hit.coords[1], at: Date.now() })
      }
      return
    }
    setSelected(null)
  }, [route.view, route.slug])

  // Scroll position per route: back out of a profile and the feed is where you
  // left it, not at the top.
  const scrollKeyRef = useRef('map')
  useEffect(() => {
    const key = location.hash || '#/'
    scrollKeyRef.current = key
    // Images keep arriving after the route renders, so the page is still
    // growing: keep asking until the position actually takes, rather than
    // setting it once against a page that is too short to hold it.
    let tries = 0
    const want = recallScroll(key)
    const restore = () => {
      const page = document.querySelector('.page')
      if (page && want > 0) {
        page.scrollTop = want
        if (Math.abs(page.scrollTop - want) < 2) return
      } else if (page) return
      if (tries++ < 25) setTimeout(restore, 100)
    }
    restore()
  }, [route.view, route.handle, route.slug])

  const selectedSpot = SPOTS.find((s) => s.id === selected)

  const effNow = viewTime ?? now
  // heat boost for spots with an active post/event on the board
  const boosts = useMemo(() => {
    const b = {}
    for (const e of events) if (!e.dying && e.spotId) b[e.spotId] = (b[e.spotId] || 0) + (e.id.startsWith('u-') ? 8 : 5)
    return b
  }, [events])

  // scrubber: hours-of-week axis anchored to this week's Sunday midnight
  const weekStart = useMemo(() => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    return d.getTime()
  }, [Math.floor(now / 3600000)])
  const nowIdx = Math.floor((now - weekStart) / 3600000)
  const scrubIdx = viewTime === null ? nowIdx : Math.floor((viewTime - weekStart) / 3600000)
  // the exact moment the map is showing, spoken plainly: "Fri 10 PM" / "Now"
  const momentLabel = viewTime === null
    ? 'Now'
    : new Date(viewTime).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
      new Date(viewTime).toLocaleTimeString('en-US', { hour: 'numeric' }).replace(':00', '')

  return (
    <div className="app">
      <CityMap activeCats={activeCats} selected={selected} onSelect={setSelected} eventCounts={eventCounts} metroOn={metroOn} effNow={effNow} boosts={boosts} onTrain={setTrainSel} fieldPosts={fieldPosts} onPlacePost={(pl) => wantPost(null, pl)} flyTo={flyPlace} dropAt={dropAt} />

      <header className="topbar">
        <div className="brand">
          <h1 className="wordmark">out<span className="wordmark-dot">.</span></h1>
          <p className="micro brand-sub">washington, d.c.</p>
        </div>
        <div className="topbar-right">
          <p className="clock micro">
            <span className="clock-long">{clockLine(now)}</span>
            <span className="clock-short">
              {new Date(now).toLocaleDateString('en-US', { weekday: 'short' })} ·{' '}
              {new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </p>
          {session && (
            <button className="acct-btn" aria-label="Messages" title="Messages" onClick={() => { setDmWith(null); adult ? setDmOpen(true) : setAgeOpen(true) }}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="1.8" y="3.4" width="12.4" height="9.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M2.4 4.6 8 8.8l5.6-4.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button className="acct-btn" aria-label="Search" title="Search" onClick={() => setSearchOpen(true)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M10.4 10.4 L14 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className={`acct-btn ${profile ? 'acct-in' : ''}`}
            aria-label={profile ? `Account — @${profile.username}` : 'Sign in'}
            title={profile ? `@${profile.username}` : 'Sign in'}
            onClick={() => { setAuthIntent(false); setAcctOpen(true) }}
          >
            {profile ? (
              <span className="acct-initial">{profile.username[0]}</span>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="5.4" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M2.8 13.6c.9-2.4 2.9-3.6 5.2-3.6s4.3 1.2 5.2 3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {sinceLine && (
        <p className="since-line micro" role="status">
          {sinceLine}
          <button className="since-dismiss" aria-label="Dismiss" onClick={() => setSinceLine(null)}>×</button>
        </p>
      )}

      <RightNow activeCats={activeCats} at={effNow} onOpenSpot={setSelected} />

      <div className="bottom-ui">
        <div className="quick-row">
          <button
            className="legend"
            aria-expanded={crowdsOpen}
            onClick={() => {
              if (window.matchMedia('(max-width: 899px)').matches) setCrowdsOpen((v) => !v)
              else setRightNowOpen(true)
            }}
          >
            <span className="legend-dot" aria-hidden="true" />
            what’s busy right now
            <svg className={`legend-chev ${crowdsOpen ? 'open' : ''}`} viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            className={`pill metro-pill ${metroOn ? 'pill-on metro-on' : ''}`}
            aria-pressed={metroOn}
            aria-label="Toggle Metro lines"
            onClick={toggleMetro}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 13 V4 L8 10.5 L13.5 4 V13" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Metro
          </button>
        </div>

        <div className={`scrub-collapse ${crowdsOpen ? 'open' : ''}`}>
        <div className={`scrubber ${viewTime !== null ? 'scrubbing' : ''}`}>
          <span className="micro scrub-label">Crowds by hour</span>
          <div className="scrub-track">
            <span
              className="scrub-thumb-label micro"
              style={{ '--pos': `${(scrubIdx / 167) * 100}%` }}
            >
              {momentLabel}
            </span>
            <input
              type="range"
              min="0"
              max="167"
              value={scrubIdx}
              aria-label="Explore crowds through the week"
              aria-valuetext={momentLabel}
              onChange={(e) => {
                const idx = Number(e.target.value)
                setViewTime(idx === nowIdx ? null : weekStart + idx * 3600000)
              }}
            />
            <span className="scrub-ticks micro" aria-hidden="true">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </span>
          </div>
          <button
            className="scrub-now"
            disabled={viewTime === null}
            onClick={() => setViewTime(null)}
          >
            now
          </button>
        </div>
        </div>

        <nav className="filters" aria-label="Filter by kind">
          {(() => {
            const allOn = activeCats.size === ALL_CATS.length
            return (
              <>
                <button
                  className={`pill filter-pill filter-all ${allOn ? 'pill-on' : ''}`}
                  aria-pressed={allOn}
                  onClick={() => toggleCat('all')}
                >
                  All
                </button>
                {ALL_CATS.map((id) => {
                  const cat = CATEGORIES[id]
                  const on = !allOn && activeCats.has(id)
                  return (
                    <button
                      key={id}
                      className={`pill filter-pill ${on ? 'pill-on' : ''}`}
                      aria-pressed={on}
                      style={on ? { '--pill-tint': cat.deep } : undefined}
                      onClick={() => toggleCat(id)}
                    >
                      <span className="pill-dot" style={{ background: cat.color }} aria-hidden="true" />
                      {cat.label}
                    </button>
                  )
                })}
              </>
            )
          })()}
        </nav>

      </div>

      {tab === 'tonight' && (
        <TonightPage events={liveEvents} now={effNow} activeCats={activeCats} onOpenSpot={setSelected} onOpenProfile={(u) => go({ view: 'profile', handle: u })} />
      )}
      {tab === 'feed' && (
        <FeedPage
          events={liveEvents}
          now={now}
          onOpenSpot={setSelected}
          onOpenProfile={(u, isOrg) => go({ view: isOrg ? 'org' : 'profile', handle: u })}
          onOpenPlace={(pl) => { setTab('map'); setFlyPlace({ ...pl, at: Date.now() }) }}
          authed={!!session}
          onNeedAccount={() => { setAuthIntent(false); setAcctOpen(true) }}
        />
      )}

      <TabBar
        tab={tab}
        onTab={(id) => {
          if (id === 'you' && !profile) { setAuthIntent(false); setAcctOpen(true); return }
          setTab(id)
        }}
        onPost={() => wantPost(null)}
        onSearch={() => setSearchOpen(true)}
        clock={clockLine(now)}
        profile={profile}
      />

      {opener && tab === 'map' && (() => {
        const top3 = [...SPOTS]
          .filter((s) => activeCats.has(s.cat))
          .sort((a, b) => liveBusy(b, now) - liveBusy(a, now))
          .slice(0, 3)
        return (
          <div className="opener" role="dialog" aria-label="Busiest right now">
            <div className="sheet-grab" aria-hidden="true" />
            <p className="micro opener-kicker">Busiest right now</p>
            <ul className="opener-list">
              {top3.map((s) => (
                <li key={s.id}>
                  <button className="opener-row" onClick={() => { setOpener(false); setSelected(s.id) }}>
                    <img className="opener-thumb" src={thumb(spotPhoto(s.id)?.src) || artUrl(s.art)} alt="" />
                    <span className="opener-body">
                      <span className="opener-name">{s.name}</span>
                      <span className="micro opener-word">{crowdWord(liveBusy(s, now))} · {s.area}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="opener-dismiss micro" onClick={() => setOpener(false)}>see the whole map</button>
          </div>
        )
      })()}

      {dropChip && <div className="drop-chip micro" role="status">{dropChip}</div>}
      {toast && <div className="toast micro" role="status">{toast}</div>}

      {trainSel && <TrainSheet train={trainSel} onClose={() => setTrainSel(null)} />}

      {rightNowOpen && (
        <div className="sheet-scrim" onClick={() => setRightNowOpen(false)}>
          <section className="sheet" role="dialog" aria-label="Busiest right now" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" aria-hidden="true" />
            <RightNow
              activeCats={activeCats}
              at={effNow}
              count={10}
              className="rightnow-sheet"
              onOpenSpot={(id) => { setRightNowOpen(false); setSelected(id) }}
            />
          </section>
        </div>
      )}

      {selectedSpot && (
        <SpotSheet
          spot={selectedSpot}
          events={liveEvents.filter((e) => e.spotId === selectedSpot.id)}
          now={now}
          onClose={() => { setSelected(null); if (route.view === 'spot') go({ view: 'map' }, { replace: true }) }}
          onPost={(id) => { setSelected(null); wantPost(id) }}
          authed={!!session}
          me={session?.user?.id || null}
          onNeedAccount={() => { setAuthIntent(false); setAcctOpen(true) }}
          onOpenProfile={(u, isOrg) => { setSelected(null); go({ view: isOrg ? 'org' : 'profile', handle: u }) }}
          onToast={setToast}
        />
      )}

      {(route.view === 'profile' || (route.view === 'me' && profile)) && (
        <ProfilePage
          username={route.view === 'me' ? profile?.username : route.handle}
          isMe={route.view === 'me'}
          events={liveEvents}
          now={now}
          onBack={() => (history.length > 1 ? history.back() : go({ view: 'map' }))}
          onOpenSpot={(id) => go({ view: 'spot', slug: slugify(SPOTS.find((s) => s.id === id)?.name || id) })}
          onStory={(u) => setStoryFor(u)}
          onToast={setToast}
          onClaimOrg={() => setClaimOpen(true)}
          onMessage={(person) => {
            if (!session) { setAuthIntent(false); setAcctOpen(true); return }
            setDmWith(person)
            if (adult) setDmOpen(true)
            else setAgeOpen(true)
          }}
          onVerifySchool={() => setVerifyOpen(true)}
          verified={verified}
        />
      )}

      {route.view === 'org' && (
        <OrgPage
          handle={route.handle}
          now={now}
          member={myOrgs.some((o) => o.handle === route.handle)}
          onBack={() => (history.length > 1 ? history.back() : go({ view: 'map' }))}
          onOpenSpot={(id) => go({ view: 'spot', slug: slugify(SPOTS.find((s) => s.id === id)?.name || id) })}
          onToast={setToast}
        />
      )}

      {ageOpen && (
        <AgeGateSheet
          onClose={() => setAgeOpen(false)}
          onToast={setToast}
          onResult={(isAdult) => {
            setAdult(isAdult)
            if (isAdult) { setAgeOpen(false); setDmOpen(true) }
          }}
        />
      )}

      {dmOpen && session && (
        <MessagesSheet
          me={session.user}
          openWith={dmWith}
          onClose={() => { setDmOpen(false); setDmWith(null) }}
          onToast={setToast}
          onOpenProfile={(u) => { if (u) { setDmOpen(false); go({ view: 'profile', handle: u }) } }}
        />
      )}

      {claimOpen && <OrgClaimSheet onClose={() => setClaimOpen(false)} onToast={setToast} />}

      {verifyOpen && (
        <SchoolVerifySheet
          onClose={() => setVerifyOpen(false)}
          onToast={setToast}
          onDone={(d) => setVerified({ domain: d.domain })}
        />
      )}

      {storyFor && (
        <StoryViewer
          username={storyFor}
          stories={liveEvents.filter((e) => e.by === storyFor && !e.dying)}
          now={now}
          onClose={() => setStoryFor(null)}
          onOpenSpot={(id) => setSelected(id)}
        />
      )}

      {searchOpen && (
        <SearchSheet
          now={effNow}
          onClose={() => setSearchOpen(false)}
          onPick={(id) => { setSearchOpen(false); setTab('map'); setSelected(id) }}
        />
      )}

      {acctOpen && (
        <AccountSheet
          profile={profile}
          intent={authIntent !== false}
          onViewProfile={(u) => { setAcctOpen(false); go({ view: 'profile', handle: u }) }}
          onClose={() => { setAcctOpen(false); setAuthIntent(false) }}
          onAuthed={() => {
            setAcctOpen(false)
            if (authIntent !== false) {
              setPlaceFor(authIntent.place || null)
              setPostFor(authIntent.place ? null : authIntent.spotId)
            }
            setAuthIntent(false)
          }}
        />
      )}

      {postFor !== false && (
        <PostSheet
          initialSpot={postFor}
          place={placeFor}
          now={now}
          username={profile?.username}
          orgs={myOrgs}
          onClose={() => { setPostFor(false); setPlaceFor(null) }}
          onSubmit={async (ev) => {
            let shots = {}
            if (ev.photoFile) {
              try {
                shots = await uploadPostPhoto(ev.photoFile, session.user.id)
              } catch {
                return 'the photo didn’t upload — try again, or post without it'
              }
            }
            const row = placeFor
              ? { title: ev.title, expires_at: new Date(ev.endsAt).toISOString(), audience: ev.audience, org_id: ev.orgId, ...shots, place_name: placeFor.name, lat: placeFor.lat, lng: placeFor.lng }
              : { spot_id: ev.spotId, title: ev.title, expires_at: new Date(ev.endsAt).toISOString(), audience: ev.audience, org_id: ev.orgId, ...shots }
            const { data, error } = await supa.from('posts').insert(row).select().single()
            if (error) return error.message // moderation speaks in plain sentences
            const id = `u-${data.id}`
            const by = data.username || profile?.username || null
            setEvents((evs) => (evs.some((e) => e.id === id) ? evs : [
              placeFor
                ? { id, spotId: null, title: ev.title, endsAt: ev.endsAt, photo: null, img: shots.mid_path || shots.photo_path || null, thumb: shots.thumb_path || null, postId: data.id, by, place: placeFor.name, lat: placeFor.lat, lng: placeFor.lng }
                : { ...ev, id, photo: null, img: shots.mid_path || shots.photo_path || null, thumb: shots.thumb_path || null, postId: data.id, by },
              ...evs,
            ]))
            setPostFor(false)
            // the pin-drop moment: spring the marker, warm its heat, count the badge
            if (placeFor) {
              setPlaceFor(null)
              setFlyPlace({ lng: placeFor.lng, lat: placeFor.lat, at: Date.now() })
            } else {
              setSelected(null)
              setDropAt({ spotId: ev.spotId, at: Date.now() })
              const spot = SPOTS.find((s) => s.id === ev.spotId)
              if (spot && profile?.username) {
                // honest progress: their own posts in this lane, including this one
                const lane = CATEGORIES[spot.cat]
                const mineInLane = new Set(
                  events
                    .filter((e) => e.by === profile.username && e.spotId && SPOTS.find((s) => s.id === e.spotId)?.cat === spot.cat)
                    .map((e) => e.spotId),
                )
                mineInLane.add(ev.spotId)
                const count = Math.min(3, mineInLane.size)
                setDropChip(count >= 3 ? `${lane.label} badge earned` : `${count} of 3 toward ${lane.label}`)
                setTimeout(() => setDropChip(null), 4200)
              }
            }
            try { navigator.vibrate?.(10) } catch { /* no haptics here */ }
            return null
          }}
        />
      )}
    </div>
  )
}
