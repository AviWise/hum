import { SPOTS, CATEGORIES, liveBusy } from '../data/spots.js'
import { RightNow } from './Tonight.jsx'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function TonightPage({ events, now, activeCats, onOpenSpot, onOpenProfile }) {
  const d = new Date(now)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
  const dateLine = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase()
  const topLive = Math.max(...SPOTS.map((s) => liveBusy(s, now)))
  const evening = d.getHours() >= 17 || d.getHours() < 5
  const mood = topLive >= 70
    ? `Big ${dayName} ${evening ? 'night' : ''}`
    : topLive >= 40 ? `Steady ${dayName}` : `Quiet ${dayName}`
  const live = events.filter((e) => !e.dying).sort((a, b) => a.endsAt - b.endsAt)

  return (
    <section className="page" aria-label="Tonight">
      <header className="page-head">
        <h2 className="page-title">{mood.trim()}</h2>
        <p className="micro">{dayName.toLowerCase()} · {dateLine} · posts disappear when they end</p>
      </header>

      <RightNow activeCats={activeCats} at={now} count={8} className="rightnow-page" onOpenSpot={onOpenSpot} />

      <p className="micro block-label">On the board</p>
      {live.length === 0 ? (
        <p className="empty-line">Quiet for now — be the first to post.</p>
      ) : (
        <ul className="tp-list">
          {live.map((ev) => {
            const spot = bySpot[ev.spotId]
            if (!spot) return null
            const cat = CATEGORIES[spot.cat]
            const img = EVENT_PHOTOS[ev.id]?.src || ev.img || (ev.id.startsWith('u') ? null : spotPhoto(spot.id)?.src)
            const closing = ev.endsAt - now < 30 * 60000
            return (
              <li key={ev.id} className={`tp-card ${ev.dying ? 'dying' : ''}`}>
                <button className="tp-hit" onClick={() => onOpenSpot(spot.id)}>
                  {img
                    ? <img className="tp-img" src={img} alt="" loading="lazy" />
                    : <div className="tp-band" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.deep})` }} aria-hidden="true" />}
                  <div className="tp-body">
                    <p className="micro tp-meta">
                      <span style={{ color: cat.deep }}>{spot.name}</span>
                      <span className={`countdown ${closing ? 'closing' : ''}`}>{timeLeft(ev.endsAt, now)} left</span>
                    </p>
                    <p className="tp-title">{ev.title}</p>
                    {ev.by && (
                      <p className="micro ev-by">
                        <span className="ev-by-link" role="button" tabIndex="0"
                          onClick={(e) => { e.stopPropagation(); onOpenProfile(ev.by) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenProfile(ev.by) } }}>
                          @{ev.by}
                        </span>
                      </p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
