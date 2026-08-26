import { SPOTS, CATEGORIES } from '../data/spots.js'
import { ILLOS } from './Illustrations.jsx'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

export default function Tonight({ events, now, onOpenSpot }) {
  return (
    <section className="tonight" aria-label="Tonight’s posts">
      <header className="tonight-head">
        <h2 className="tonight-title">Tonight</h2>
        <p className="micro">posts disappear when they end</p>
      </header>
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
    </section>
  )
}

export function RightNow({ activeCats, onOpenSpot }) {
  const top = SPOTS.filter((s) => activeCats.has(s.cat)).sort((a, b) => b.busy - a.busy).slice(0, 5)
  return (
    <aside className="rightnow" aria-label="Busiest right now">
      <h2 className="tonight-title">Right now</h2>
      <ul>
        {top.map((s) => (
          <li key={s.id}>
            <button className="rn-row" onClick={() => onOpenSpot(s.id)}>
              <span className="rn-name">{s.name}</span>
              <span className="rn-meter" aria-label={`busyness ${s.busy} of 100`}>
                <span className="rn-fill" style={{ width: `${s.busy}%`, background: CATEGORIES[s.cat].color }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
