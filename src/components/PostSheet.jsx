import { useRef, useState } from 'react'
import { SPOTS } from '../data/spots.js'

// shrink camera-roll images to a friendly size before upload
async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}

const DURATIONS = [
  { label: '1 hour', min: 60 },
  { label: '3 hours', min: 180 },
  { label: 'Til 2am', min: null },
]

export default function PostSheet({ initialSpot, place, now, username, onClose, onSubmit }) {
  const [spotId, setSpotId] = useState(initialSpot || 'admo')
  const [text, setText] = useState('')
  const [dur, setDur] = useState(1)
  const [err, setErr] = useState(null)
  const [photo, setPhoto] = useState(null) // { blob, preview }
  const fileRef = useRef(null)

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const blob = await shrink(f)
      setPhoto({ blob, preview: URL.createObjectURL(blob) })
    } catch {
      setErr('That photo didn’t want to load — try another.')
    }
  }

  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
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
    setBusy(true)
    const verdict = await onSubmit({ spotId, title: text.trim(), endsAt, photoBlob: photo?.blob || null })
    setBusy(false)
    if (verdict) setErr(verdict)
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Post to the map" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        <h2 className="sheet-name post-title">What’s going on?</h2>
        <p className="micro post-sub">
          {username ? <>Posting as <strong>@{username}</strong> — </> : null}
          your post goes live on everyone’s map, then disappears when it ends.
        </p>
        <form onSubmit={submit}>
          <label className="micro block-label" htmlFor="post-spot">Where</label>
          {place ? (
            <p className="post-place">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.6c2.6 0 4.6 2 4.6 4.4C12.6 10.4 8 13.8 8 13.8S3.4 10.4 3.4 7C3.4 4.6 5.4 2.6 8 2.6z" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="7" r="1.6" fill="currentColor" /></svg>
              {place.name}
            </p>
          ) : (
            <div className="select-wrap">
              <select id="post-spot" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
                {[...SPOTS].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.area}</option>
                ))}
              </select>
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}

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

          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          {photo ? (
            <div className="post-photo-row">
              <img className="post-photo-preview" src={photo.preview} alt="Your photo" />
              <button type="button" className="post-photo-remove" onClick={() => setPhoto(null)}>remove</button>
            </div>
          ) : (
            <button type="button" className="pill post-photo-btn" onClick={() => fileRef.current?.click()}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="8.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="6" r="0.8" fill="currentColor" /></svg>
              Add a photo
            </button>
          )}

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
          <button type="submit" className="btn-primary post-submit" disabled={busy}>{busy ? 'Posting…' : place ? `Post from ${place.name.length > 24 ? 'here' : place.name}` : 'Put it on the map'}</button>
        </form>
      </section>
    </div>
  )
}
