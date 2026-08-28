import { SPOTS, CATEGORIES, liveBusy, busyLevel, crowdWord } from '../data/spots.js'
import { ILLOS } from './Illustrations.jsx'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function Tonight({ events, now, onOpenSpot, open, onToggle, onOpenProfile }) {
  return (
    <section className="tonight" aria-label="Tonight’s posts">
      <button className="tonight-head" aria-expanded={open} onClick={onToggle}>
        <h2 className="tonight-title">Tonight</h2>
        {!open && events.length > 0 && <span className="tonight-count">{events.length}</span>}
        {open && <p className="micro">posts disappear when they end</p>}
        <svg className={`tonight-chev ${open ? '' : 'chev-closed'}`} viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 8.5 L7 4.5 L11 8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={`tonight-collapse ${open ? '' : 'closed'}`}>
      <div className="tonight-inner">
      {events.length === 0 ? (
        <p className="empty-line tonight-empty">Quiet for now — be the first to post.</p>
      ) : (
        <ul className="tonight-rail">
          {events.map((ev) => {
            const spot = bySpot[ev.spotId]
            const cat = CATEGORIES[spot.cat]
            const photo = EVENT_PHOTOS[ev.id]?.src || ev.img || (ev.id.startsWith('u') ? null : spotPhoto(spot.id)?.src)
            const Illo = ev.photo ? ILLOS[ev.photo] : null
            const closing = ev.endsAt - now < 30 * 60000
            return (
              <li key={ev.id} className={`ev-card ${ev.dying ? 'dying' : ''}`}>
                <button className="ev-hit" onClick={() => onOpenSpot(spot.id)}>
                  {photo ? (
                    <div className="ev-illo"><img className="ev-photo" src={photo} alt="" loading="lazy" /></div>
                  ) : Illo ? (
                    <div className="ev-illo"><Illo /></div>
                  ) : (
                    <div className="ev-band" style={{ background: cat.color }} aria-hidden="true" />
                  )}
                  <div className="ev-body">
                    <p className="micro ev-meta">
                      <span style={{ color: cat.deep }}>{spot.name}</span>
                      <span className={`countdown ${closing ? 'closing' : ''}`}>{timeLeft(ev.endsAt, now)} left</span>
                    </p>
                    <p className="ev-title">{ev.title}</p>
                    {ev.by && (
                      <p className="micro ev-by">
                        <span
                          className="ev-by-link"
                          role="button"
                          tabIndex="0"
                          onClick={(e) => { e.stopPropagation(); onOpenProfile?.(ev.by) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenProfile?.(ev.by) } }}
                        >
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
      </div>
      </div>
    </section>
  )
}

export function RightNow({ activeCats, onOpenSpot, count = 5, className = 'rightnow', at }) {
  const now = at ?? Date.now()
  const top = SPOTS.filter((s) => activeCats.has(s.cat)).sort((a, b) => liveBusy(b, now) - liveBusy(a, now)).slice(0, count)
  const d = new Date(now)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
  const topLive = top.length ? liveBusy(top[0], now) : 0
  const mood = topLive >= 70 ? `Big ${dayName} night` : topLive >= 40 ? `Steady ${dayName}` : `Quiet ${dayName} ${d.getHours() >= 18 || d.getHours() < 5 ? 'night' : ''}`
  return (
    <aside className={className} aria-label="Busiest right now">
      <h2 className="tonight-title">Right now</h2>
      <p className="micro rn-mood">{mood.trim()} — busiest first</p>
      <ul>
        {top.map((s) => (
          <li key={s.id}>
            <button className="rn-row" onClick={() => onOpenSpot(s.id)}>
              <span className="rn-name">{s.name}</span>
              {/* ranked by liveBusy above — a bigger place outranks a small one at
                  equal fullness — but the word and the bar are fullness itself */}
              <span className="rn-word">{crowdWord(busyLevel(s, now))}</span>
              <span className="rn-meter" aria-label={`busyness ${busyLevel(s, now)} of 100`}>
                <span className="rn-fill" style={{ width: `${Math.min(100, busyLevel(s, now))}%`, background: CATEGORIES[s.cat].color }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
