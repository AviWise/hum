import { useState } from 'react'
import { supa } from '../lib/supa.js'
import { useEscape } from '../lib/escape'
import { useSheetExit } from '../lib/sheet-exit'

// Messaging is 18+. Asked once, plainly, at the moment it matters — not as a
// wall in front of the app, because the map is a public thing about public
// places and gating that protects nobody.
//
// You get one answer. There is no edit button, because a birth date you can
// change on demand is a toggle, not a declaration.
export default function AgeGateSheet({ onClose: rawClose, onResult, onToast }) {
  const { closing, onClose } = useSheetExit(rawClose)
  useEscape(onClose)
  const [dob, setDob] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [tooYoung, setTooYoung] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!dob) return
    const born = new Date(dob)
    if (Number.isNaN(born.getTime()) || born > new Date()) { setErr('That date doesn’t look right.'); return }
    setBusy(true)
    const { error } = await supa.from('age_checks').insert({ birth_date: dob })
    setBusy(false)
    if (error) {
      setErr(error.code === '23505'
        ? 'You’ve already answered this one.'
        : 'That didn’t save. Try again in a moment.')
      return
    }
    const eighteen = new Date(born.getFullYear() + 18, born.getMonth(), born.getDate())
    if (eighteen > new Date()) { setTooYoung(true); onResult?.(false); return }
    onResult?.(true)
    onToast?.('Messaging unlocked')
    onClose?.()
  }

  return (
    <div className={`sheet-scrim ${closing ? 'sheet-leaving' : ''}`} onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Your age" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {tooYoung ? (
          <>
            <h2 className="sheet-name post-title">Messaging is 18+</h2>
            <p className="micro post-sub">
              The rest of hum. is yours — the map, the feed, tonight, posting, and the room at
              every spot. Private messages are the one part that waits.
            </p>
            <button type="button" className="btn-primary post-submit" onClick={onClose}>Got it</button>
          </>
        ) : (
          <>
            <h2 className="sheet-name post-title">When were you born?</h2>
            <p className="micro post-sub">
              Private messages are 18+. Everything else on hum. stays open either way. We ask
              once, we keep the date to ourselves, and nobody else can see it.
            </p>
            <form onSubmit={submit}>
              <label className="micro block-label" htmlFor="age-dob">Date of birth</label>
              <input
                id="age-dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={dob}
                onChange={(e) => { setDob(e.target.value); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}
              <p className="micro aud-note">
                You only get to answer this once, so check it before you send.
              </p>
              <button type="submit" className="btn-primary post-submit" disabled={busy || !dob}>
                {busy ? 'Saving…' : 'Continue'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
