import { useEffect, useMemo, useRef, useState } from 'react'
import CityMap from './components/CityMap.jsx'
import SpotSheet from './components/SpotSheet.jsx'
import Tonight, { RightNow } from './components/Tonight.jsx'
import PostSheet from './components/PostSheet.jsx'
import { SPOTS, CATEGORIES, seedEvents } from './data/spots.js'
import { clockLine } from './lib/time.js'

const ALL_CATS = Object.keys(CATEGORIES)

export default function App() {
  const [now, setNow] = useState(() => Date.now())
  const [events, setEvents] = useState(() => seedEvents(Date.now()))
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
  const toggleMetro = () => setMetroOn((v) => {
    try { localStorage.setItem('out.metro', v ? 'off' : 'on') } catch { /* private mode */ }
    return !v
  })

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
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

  return (
    <div className="app">
      <CityMap activeCats={activeCats} selected={selected} onSelect={setSelected} eventCounts={eventCounts} metroOn={metroOn} />

      <header className="topbar">
        <div className="brand">
          <h1 className="wordmark">out<span className="wordmark-dot">.</span></h1>
          <p className="micro brand-sub">washington, d.c.</p>
        </div>
        <p className="clock micro">{clockLine(now)}</p>
      </header>

      <RightNow activeCats={activeCats} onOpenSpot={setSelected} />

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
          <button className="fab btn-primary" onClick={() => setPostFor(null)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Post
          </button>
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
          <Tonight events={liveEvents} now={now} onOpenSpot={setSelected} open={feedOpen} onToggle={toggleFeed} />
        </div>
      </div>

      {rightNowOpen && (
        <div className="sheet-scrim" onClick={() => setRightNowOpen(false)}>
          <section className="sheet" role="dialog" aria-label="Busiest right now" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" aria-hidden="true" />
            <RightNow
              activeCats={activeCats}
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
          onPost={(id) => { setSelected(null); setPostFor(id) }}
        />
      )}

      {postFor !== false && (
        <PostSheet
          initialSpot={postFor}
          now={now}
          onClose={() => setPostFor(false)}
          onSubmit={(ev) => {
            setEvents((evs) => [{ ...ev, id: `u${idRef.current++}`, photo: null }, ...evs])
            setPostFor(false)
            setSelected(ev.spotId)
          }}
        />
      )}
    </div>
  )
}
