import { SPOTS, CATEGORIES, liveBusy } from '../data/spots.js'
import { ILLOS } from './Illustrations.jsx'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function Tonight({ events, now, onOpenSpot, open, onToggle }) {
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
            const photo = EVENT_PHOTOS[ev.id]?.src || (ev.id.startsWith('u') ? null : spotPhoto(spot.id)?.src)
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

export function RightNow({ activeCats, onOpenSpot }) {
  const now = Date.now()
  const top = SPOTS.filter((s) => activeCats.has(s.cat)).sort((a, b) => liveBusy(b, now) - liveBusy(a, now)).slice(0, 5)
  return (
    <aside className="rightnow" aria-label="Busiest right now">
      <h2 className="tonight-title">Right now</h2>
      <ul>
        {top.map((s) => (
          <li key={s.id}>
            <button className="rn-row" onClick={() => onOpenSpot(s.id)}>
              <span className="rn-name">{s.name}</span>
              <span className="rn-meter" aria-label={`busyness ${liveBusy(s, now)} of 100`}>
                <span className="rn-fill" style={{ width: `${liveBusy(s, now)}%`, background: CATEGORIES[s.cat].color }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
