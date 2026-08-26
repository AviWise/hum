import { useEffect, useMemo, useRef, useState } from 'react'
import { SPOTS, CATEGORIES, liveBusy, crowdWord } from '../data/spots.js'
import { spotPhoto } from '../data/photos.js'
import { artUrl } from './markerArt.js'
import { thumb } from '../lib/img.js'

// diacritic-proof lowercase (so "dogon" finds Dōgon)
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function match(spot, q) {
  const name = fold(spot.name)
  const area = fold(spot.area)
  if (name.startsWith(q)) return { score: 100 }
  if (name.includes(q)) return { score: 80 }
  const venue = spot.venues.find((v) => fold(v).includes(q))
  if (venue) return { score: 60, via: venue }
  if (area.includes(q)) return { score: 50 }
  if (fold(CATEGORIES[spot.cat].label).includes(q)) return { score: 30 }
  if (fold(spot.vibe).includes(q)) return { score: 20 }
  return null
}

export default function SearchSheet({ now, onClose, onPick }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const results = useMemo(() => {
    const query = fold(q.trim())
    if (query.length < 2) {
      // before typing: what's worth walking toward right now
      return SPOTS
        .map((s) => ({ spot: s, live: liveBusy(s, now) }))
        .sort((a, b) => b.live - a.live)
        .slice(0, 6)
        .map((r) => ({ ...r, hint: 'busy right now' }))
    }
    return SPOTS
      .map((s) => {
        const m = match(s, query)
        return m ? { spot: s, live: liveBusy(s, now), score: m.score, via: m.via } : null
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.live - a.live)
      .slice(0, 8)
  }, [q, now])

  return (
    <div className="sheet-scrim search-scrim" onClick={onClose}>
      <section className="search-panel" role="dialog" aria-label="Search the map" onClick={(e) => e.stopPropagation()}>
        <div className="search-row">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="search-glass">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            placeholder="A place, a block, a bar…"
            aria-label="Search spots"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && results.length) { onPick(results[0].spot.id) }
            }}
          />
          <button className="search-cancel" onClick={onClose}>cancel</button>
        </div>

        {q.trim().length < 2 && <p className="micro search-head">Busy right now</p>}
        <ul className="search-results">
          {results.map(({ spot, live, via, hint }) => {
            const cat = CATEGORIES[spot.cat]
            const img = thumb(spotPhoto(spot.id)?.src) || artUrl(spot.art)
            return (
              <li key={spot.id}>
                <button className="search-hit" onClick={() => onPick(spot.id)}>
                  <img className="search-thumb" src={img} alt="" loading="lazy" />
                  <span className="search-body">
                    <span className="search-name">{spot.name}</span>
                    <span className="micro search-sub">
                      <span className="pill-dot" style={{ background: cat.color }} aria-hidden="true" />
                      {via ? <>{via} · </> : null}
                      {spot.area}
                      {hint ? <> · {crowdWord(live)}</> : null}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {q.trim().length >= 2 && results.length === 0 && (
            <li className="empty-line search-empty">Nothing by that name — try a neighborhood, a venue, or a vibe.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
