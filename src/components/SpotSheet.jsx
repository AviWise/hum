import { CATEGORIES, crowdWord } from '../data/spots.js'
import { ILLOS } from './Illustrations.jsx'
import { artUrl } from './markerArt.js'
import { spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'

export default function SpotSheet({ spot, events, now, onClose, onPost }) {
  const cat = CATEGORIES[spot.cat]
  const word = crowdWord(spot.busy)
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
          <div className="crowd-meter" role="img" aria-label={`${word} — busyness ${spot.busy} out of 100`}>
            <div className="crowd-fill" style={{ width: `${spot.busy}%` }} />
          </div>
          <span className="crowd-word">{word} right now</span>
        </div>

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
