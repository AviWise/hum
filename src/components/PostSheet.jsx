import { useState } from 'react'
import { SPOTS } from '../data/spots.js'

const DURATIONS = [
  { label: '1 hour', min: 60 },
  { label: '3 hours', min: 180 },
  { label: 'Til 2am', min: null },
]

export default function PostSheet({ initialSpot, now, onClose, onSubmit }) {
  const [spotId, setSpotId] = useState(initialSpot || 'admo')
  const [text, setText] = useState('')
  const [dur, setDur] = useState(1)
  const [err, setErr] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    if (text.trim().length < 4) {
      setErr('Say a little more — four characters at least, so people know what’s on.')
      return
    }
    const d = DURATIONS[dur]
    let endsAt
    if (d.min) endsAt = now + d.min * 60000
    else {
      const twoAm = new Date(now)
      twoAm.setHours(2, 0, 0, 0)
      if (new Date(now).getHours() >= 2) twoAm.setDate(twoAm.getDate() + 1)
      endsAt = twoAm.getTime()
    }
    onSubmit({ spotId, title: text.trim(), endsAt })
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Post to the map" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        <h2 className="sheet-name post-title">What’s going on?</h2>
        <p className="micro post-sub">Your post goes live on everyone’s map, then disappears when it ends.</p>
        <form onSubmit={submit}>
          <label className="micro block-label" htmlFor="post-spot">Where</label>
          <div className="select-wrap">
            <select id="post-spot" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              {[...SPOTS].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.area}</option>
              ))}
            </select>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>

          <label className="micro block-label" htmlFor="post-text">What</label>
          <textarea
            id="post-text"
            rows="3"
            maxLength="120"
            placeholder="Line’s short, band starts at 10…"
            value={text}
            onChange={(e) => { setText(e.target.value); setErr(null) }}
          />
          {err && <p className="form-err" role="alert">{err}</p>}

          <p className="micro block-label">How long it stays up</p>
          <div className="dur-row" role="radiogroup" aria-label="Post duration">
            {DURATIONS.map((d, i) => (
              <button
                type="button"
                key={d.label}
                role="radio"
                aria-checked={dur === i}
                className={`pill ${dur === i ? 'pill-on' : ''}`}
                onClick={() => setDur(i)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button type="submit" className="btn-primary post-submit">Put it on the map</button>
        </form>
      </section>
    </div>
  )
}
