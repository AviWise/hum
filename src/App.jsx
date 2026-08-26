import { useEffect, useMemo, useRef, useState } from 'react'
import CityMap from './components/CityMap.jsx'
import SpotSheet from './components/SpotSheet.jsx'
import Tonight, { RightNow } from './components/Tonight.jsx'
import PostSheet from './components/PostSheet.jsx'
import TrainSheet from './components/TrainSheet.jsx'
import AccountSheet from './components/AccountSheet.jsx'
import SearchSheet from './components/SearchSheet.jsx'
import ProfileSheet from './components/ProfileSheet.jsx'
import StoryViewer from './components/StoryViewer.jsx'
import { attachAuthor } from './data/people.js'
import { SPOTS, CATEGORIES, seedEvents } from './data/spots.js'
import { clockLine } from './lib/time.js'
import { supa } from './lib/supa.js'

const ALL_CATS = Object.keys(CATEGORIES)

export default function App() {
  const [now, setNow] = useState(() => Date.now())
  const [events, setEvents] = useState(() => seedEvents(Date.now()).map(attachAuthor))
  const [activeCats, setActiveCats] = useState(() => new Set(ALL_CATS))
  const [selected, setSelected] = useState(null)
  const [postFor, setPostFor] = useState(false) // false | null (any spot) | spotId
  const [feedOpen, setFeedOpen] = useState(() => {
    try { return localStorage.getItem('out.feed') !== 'closed' } catch { return true }
  })
  const [metroOn, setMetroOn] = useState(() => {
    try { return localStorage.getItem('out.metro') === 'on' } catch { return false }
  })
  const idRef = useRef(100)

  const toggleFeed = () => setFeedOpen((v) => {
    try { localStorage.setItem('out.feed', v ? 'closed' : 'open') } catch { /* private mode */ }
    return !v
  })
  const [rightNowOpen, setRightNowOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [acctOpen, setAcctOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileFor, setProfileFor] = useState(null) // username whose profile is open
  const [storyFor, setStoryFor] = useState(null) // username whose story is playing
  const [authIntent, setAuthIntent] = useState(false) // false = just browsing account; null | spotId = wants to post
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

  // who's signed in (persists in localStorage; also catches the Google redirect)
  useEffect(() => {
    supa.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supa.auth.onAuthStateChange((_ev, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setProfile(null); return }
    supa.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [session?.user?.id])

  const wantPost = (spotId) => {
    if (session) setPostFor(spotId)
    else { setAuthIntent(spotId); setAcctOpen(true) }
  }

  // shared posts: load what's live, then follow inserts in realtime
  useEffect(() => {
    const toEvent = (r) => ({ id: `u-${r.id}`, spotId: r.spot_id, title: r.title, endsAt: Date.parse(r.expires_at), photo: null, by: r.username || null })
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
      const next = new Set(prev)
      if (next.has(id) && next.size === 1) return new Set(ALL_CATS) // tap the last one again = back to all
      if (prev.size === ALL_CATS.length) return new Set([id]) // from "all", focus one
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const liveEvents = useMemo(
    () => [...events].sort((a, b) => a.endsAt - b.endsAt),
    [events],
  )
  const eventCounts = useMemo(() => {
    const c = {}
    for (const e of events) if (!e.dying) c[e.spotId] = (c[e.spotId] || 0) + 1
    return c
  }, [events])

  const selectedSpot = SPOTS.find((s) => s.id === selected)

  const effNow = viewTime ?? now
  // heat boost for spots with an active post/event on the board
  const boosts = useMemo(() => {
    const b = {}
    for (const e of events) if (!e.dying) b[e.spotId] = (b[e.spotId] || 0) + (e.id.startsWith('u-') ? 8 : 5)
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
  const scrubLabel = viewTime === null
    ? 'crowds now'
    : new Date(viewTime).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
      new Date(viewTime).toLocaleTimeString('en-US', { hour: 'numeric' }).toLowerCase().replace(' ', '')

  return (
    <div className="app">
      <CityMap activeCats={activeCats} selected={selected} onSelect={setSelected} eventCounts={eventCounts} metroOn={metroOn} effNow={effNow} boosts={boosts} onTrain={setTrainSel} />

      <header className="topbar">
        <div className="brand">
          <h1 className="wordmark">out<span className="wordmark-dot">.</span></h1>
          <p className="micro brand-sub">washington, d.c.</p>
        </div>
        <div className="topbar-right">
          <p className="clock micro">{clockLine(now)}</p>
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

      <RightNow activeCats={activeCats} at={effNow} onOpenSpot={setSelected} />

      <div className="bottom-ui">
        <div className="quick-row">
          <button className="legend" onClick={() => setRightNowOpen(true)}>
            <span className="legend-dot" aria-hidden="true" />
            what’s busy right now
          </button>
          <button
            className={`metro-btn ${metroOn ? 'metro-on' : ''}`}
            aria-pressed={metroOn}
            aria-label="Toggle Metro lines"
            title="Metro lines"
            onClick={toggleMetro}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 13 V4 L8 10.5 L13.5 4 V13" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="fab btn-primary" onClick={() => wantPost(null)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Post
          </button>
        </div>

        <div className={`scrubber ${viewTime !== null ? 'scrubbing' : ''}`}>
          <span className="micro scrub-label">{scrubLabel}</span>
          <input
            type="range"
            min="0"
            max="167"
            value={scrubIdx}
            aria-label="Explore crowds through the week"
            onChange={(e) => {
              const idx = Number(e.target.value)
              setViewTime(idx === nowIdx ? null : weekStart + idx * 3600000)
            }}
          />
          {viewTime !== null && (
            <button className="scrub-now" onClick={() => setViewTime(null)}>now</button>
          )}
        </div>

        <nav className="filters" aria-label="Filter by kind">
          {ALL_CATS.map((id) => {
            const cat = CATEGORIES[id]
            const on = activeCats.has(id)
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
        </nav>

        <div className="dock">
          <Tonight events={liveEvents} now={now} onOpenSpot={setSelected} open={feedOpen} onToggle={toggleFeed} onOpenProfile={setProfileFor} />
        </div>
      </div>

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
          onClose={() => setSelected(null)}
          onPost={(id) => { setSelected(null); wantPost(id) }}
          authed={!!session}
          onNeedAccount={() => { setAuthIntent(false); setAcctOpen(true) }}
          onOpenProfile={(u) => { setSelected(null); setProfileFor(u) }}
        />
      )}

      {profileFor && !storyFor && (
        <ProfileSheet
          username={profileFor}
          events={liveEvents}
          now={now}
          onClose={() => setProfileFor(null)}
          onOpenSpot={(id) => { setProfileFor(null); setSelected(id) }}
          onStory={(u) => setStoryFor(u)}
        />
      )}

      {storyFor && (
        <StoryViewer
          username={storyFor}
          stories={liveEvents.filter((e) => e.by === storyFor && !e.dying)}
          now={now}
          onClose={() => setStoryFor(null)}
          onOpenSpot={(id) => { setProfileFor(null); setSelected(id) }}
        />
      )}

      {searchOpen && (
        <SearchSheet
          now={effNow}
          onClose={() => setSearchOpen(false)}
          onPick={(id) => { setSearchOpen(false); setSelected(id) }}
        />
      )}

      {acctOpen && (
        <AccountSheet
          profile={profile}
          intent={authIntent !== false}
          onViewProfile={(u) => { setAcctOpen(false); setProfileFor(u) }}
          onClose={() => { setAcctOpen(false); setAuthIntent(false) }}
          onAuthed={() => {
            setAcctOpen(false)
            if (authIntent !== false) setPostFor(authIntent)
            setAuthIntent(false)
          }}
        />
      )}

      {postFor !== false && (
        <PostSheet
          initialSpot={postFor}
          now={now}
          username={profile?.username}
          onClose={() => setPostFor(false)}
          onSubmit={async (ev) => {
            const { data, error } = await supa
              .from('posts')
              .insert({ spot_id: ev.spotId, title: ev.title, expires_at: new Date(ev.endsAt).toISOString() })
              .select()
              .single()
            if (error) return error.message // moderation speaks in plain sentences
            const id = `u-${data.id}`
            setEvents((evs) => (evs.some((e) => e.id === id) ? evs : [{ ...ev, id, photo: null, by: data.username || profile?.username || null }, ...evs]))
            setPostFor(false)
            setSelected(ev.spotId)
            return null
          }}
        />
      )}
    </div>
  )
}
