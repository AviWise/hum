import { useEffect, useState } from 'react'
import { CATEGORIES, crowdWord, liveBusy, typicalHours, venueFor } from '../data/spots.js'
import { ILLOS } from './Illustrations.jsx'
import { artUrl } from './markerArt.js'
import { spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

export default function SpotSheet({ spot, events, now, onClose, onPost }) {
  const cat = CATEGORIES[spot.cat]
  const hours = typicalHours(spot, now)
  const [rt, setRt] = useState(null) // realtime foot traffic from the edge function

  useEffect(() => {
    setRt(null)
    const v = venueFor(spot.id)
    if (!v) return
    const ctrl = new AbortController()
    fetch('https://hxmjszgvkynrwscelnzx.supabase.co/functions/v1/busy-live', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX',
      },
      body: JSON.stringify({ spot_id: spot.id, venue_name: v.venue, venue_address: v.addr }),
    })
      .then((r) => r.json())
      .then((d) => { if (d && d.live_available) setRt(d) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [spot.id])

  // prefer the actual live reading when we have one
  const live = rt
    ? Math.max(4, Math.min(100, Math.round((rt.live_busyness / 100) * spot.busy * 1.15)))
    : liveBusy(spot, now)
  const word = crowdWord(live)
  const delta = rt && rt.forecast_busyness != null ? rt.live_busyness - rt.forecast_busyness : null
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section
        className="sheet sheet-tinted"
        role="dialog"
        aria-label={spot.name}
        onClick={(e) => e.stopPropagation()}
        style={{ '--tint': cat.color, '--tint-deep': cat.deep }}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head">
          {(spotPhoto(spot.id) || artUrl(spot.art)) && (
            <img className="sheet-art" src={spotPhoto(spot.id)?.src || artUrl(spot.art)} alt="" />
          )}
          <div>
            <h2 className="sheet-name">{spot.name}</h2>
            <p className="micro sheet-area">
              {spot.area} <span aria-hidden="true">·</span> <span className="sheet-kind">{cat.label}</span>
            </p>
          </div>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="crowd">
          <div className="crowd-meter" role="img" aria-label={`${word} — busyness ${live} out of 100`}>
            <div className="crowd-fill" style={{ width: `${live}%` }} />
          </div>
          <span className="crowd-word">{word} right now</span>
        </div>
        {rt && (
          <p className="micro hours-line live-line">
            live: {rt.live_busyness}% full
            {delta !== null && (
              <> · {delta > 12 ? 'busier than usual' : delta < -12 ? 'quieter than usual' : 'about as usual'}</>
            )}
          </p>
        )}
        {hours && (
          <p className="micro hours-line">
            {hours.closed ? 'typically closed today' : `typically open ${hours.label} today`} · from foot-traffic data
          </p>
        )}

        <p className="vibe">“{spot.vibe}”</p>

        <p className="micro block-label">The anchors</p>
        <ul className="venues">
          {spot.venues.map((v) => <li key={v}>{v}</li>)}
        </ul>

        <p className="micro block-label">Happening here</p>
        {events.length === 0 ? (
          <p className="empty-line">Nothing posted yet tonight — be the first.</p>
        ) : (
          <ul className="sheet-events">
            {events.map((ev) => {
              const Illo = ev.photo ? ILLOS[ev.photo] : null
              return (
                <li key={ev.id} className={ev.dying ? 'dying' : ''}>
                  {Illo && <div className="sheet-ev-illo"><Illo /></div>}
                  <div>
                    <p className="sheet-ev-title">{ev.title}</p>
                    <p className={`micro countdown ${ev.endsAt - now < 30 * 60000 ? 'closing' : ''}`}>
                      {timeLeft(ev.endsAt, now)} left
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <button className="btn-primary sheet-post" onClick={() => onPost(spot.id)}>Post from {spot.name}</button>
        {spotPhoto(spot.id)?.credit && (
          <p className="photo-credit">
            Photo:{' '}
            <a href={spotPhoto(spot.id).source} target="_blank" rel="noreferrer">
              {spotPhoto(spot.id).credit}
            </a>{' '}
            · {spotPhoto(spot.id).license}
          </p>
        )}
      </section>
    </div>
  )
}
