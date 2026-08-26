import { useEffect, useRef, useState } from 'react'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { spotPhoto } from '../data/photos.js'
import { personFor, avatarHue } from '../data/people.js'
import { timeLeft } from '../lib/time.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))
const DUR = 4500

export default function StoryViewer({ username, stories, now, onClose, onOpenSpot }) {
  const [idx, setIdx] = useState(0)
  const [tick, setTick] = useState(0) // restarts the bar animation per slide
  const timerRef = useRef(null)
  const person = personFor(username)
  const name = person?.name || username
  const hue = avatarHue(username)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (idx + 1 < stories.length) { setIdx(idx + 1); setTick((t) => t + 1) }
      else onClose()
    }, DUR)
    return () => clearTimeout(timerRef.current)
  }, [idx, stories.length, onClose])

  if (!stories.length) return null
  const ev = stories[Math.min(idx, stories.length - 1)]
  const spot = ev.spotId ? bySpot[ev.spotId] : null
  const cat = spot ? CATEGORIES[spot.cat] : CATEGORIES.niche
  const photo = ev.img || (spot ? spotPhoto(ev.spotId)?.src : null)

  const nav = (dir) => {
    clearTimeout(timerRef.current)
    const next = idx + dir
    if (next < 0) { setIdx(0); setTick((t) => t + 1); return }
    if (next >= stories.length) { onClose(); return }
    setIdx(next)
    setTick((t) => t + 1)
  }

  return (
    <div className="story-scrim" role="dialog" aria-label={`@${username}’s story`}>
      <div className="story-card" style={{ '--story-tint': cat.deep }}>
        {photo
          ? <img className="story-bg" src={photo} alt="" />
          : <div className="story-bg story-bg-wash" style={{ background: `linear-gradient(160deg, ${cat.color}, ${cat.deep})` }} />}
        <div className="story-shade" aria-hidden="true" />

        <div className="story-bars" aria-hidden="true">
          {stories.map((s, i) => (
            <span key={s.id} className={i < idx ? 'done' : ''}>
              {i === idx && <i key={tick} style={{ animationDuration: `${DUR}ms` }} />}
            </span>
          ))}
        </div>

        <header className="story-head">
          <span className="story-ava" style={{ '--ava-bg': `oklch(0.82 0.06 ${hue})`, '--ava-ink': `oklch(0.42 0.09 ${hue})` }}>{name[0]}</span>
          <span className="story-who">
            <strong>@{username}</strong>
            <span className="micro">{timeLeft(ev.endsAt, now)} left on the map</span>
          </span>
          <button className="story-close" aria-label="Close story" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </header>

        <p className="story-title">{ev.title}</p>

        <button className="story-spot" onClick={() => { if (spot) { onClose(); onOpenSpot(ev.spotId) } }}>
          <span className="pill-dot" style={{ background: cat.color }} aria-hidden="true" />
          {spot ? `${spot.name} · ${spot.area}` : ev.place || 'out there'}
        </button>

        <button className="story-zone story-zone-l" aria-label="Previous" onClick={() => nav(-1)} />
        <button className="story-zone story-zone-r" aria-label="Next" onClick={() => nav(1)} />
      </div>
    </div>
  )
}
