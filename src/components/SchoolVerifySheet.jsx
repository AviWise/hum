import { useEffect, useRef, useState } from 'react'
import { supa } from '../lib/supa.js'
import { useEscape } from '../lib/escape'

// Prove you go there. School first, then the address — picking the school is
// the easy question, and answering it lets the next screen say "that's not an
// american.edu address" instead of failing vaguely.
//
// The marks are two-tone chips carrying the school's name, never a seal, a
// mascot or an athletic wordmark: those are licensed trademarks, and a badge in
// somebody else's app reads as endorsement. Colours and a name do not.
//
// Nothing here decides anything. Every answer comes from the school-verify
// function; the client has no policy that lets it write a verification.
export default function SchoolVerifySheet({ onClose, onDone, onToast }) {
  useEscape(onClose)
  const [schools, setSchools] = useState([])
  const [school, setSchool] = useState(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('school') // school | address | code | done
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [mine, setMine] = useState(null) // the address they signed in with

  useEffect(() => {
    supa.from('schools').select('domain, name, color, accent').eq('demo', false).order('sort')
      .then(({ data }) => setSchools(data || []))
    supa.auth.getUser().then(({ data }) => setMine(data?.user?.email || null))
  }, [])

  // If they signed up with a school address, that school is almost certainly
  // the answer — start them on it rather than making them hunt for it. Once
  // only: without the latch, "Different school" clears the choice and this
  // immediately puts it back, so the back button does nothing.
  const guessed = useRef(false)
  useEffect(() => {
    if (guessed.current || !mine || !schools.length) return
    guessed.current = true
    const d = mine.split('@')[1]?.toLowerCase() || ''
    const match = schools.find((s) => d === s.domain || d.endsWith('.' + s.domain))
    if (match) { setSchool(match); setEmail(mine); setStage('address') }
  }, [mine, schools])

  const call = async (body) => {
    setBusy(true)
    setErr(null)
    const { data, error } = await supa.functions.invoke('school-verify', { body })
    setBusy(false)
    if (error) {
      let msg = 'That didn’t go through. Try again in a moment.'
      try { msg = (await error.context?.json())?.error || msg } catch { /* keep the fallback */ }
      setErr(msg)
      return null
    }
    if (data?.error) { setErr(data.error); return null }
    return data
  }

  const pick = (s) => {
    setSchool(s)
    setErr(null)
    // carry their sign-in address over only if it belongs to this school
    const d = (mine || '').split('@')[1]?.toLowerCase() || ''
    setEmail(d === s.domain || d.endsWith('.' + s.domain) ? mine : '')
    setStage('address')
  }

  const start = async (e) => {
    e.preventDefault()
    const d = await call({ action: 'start', email, domain: school.domain })
    if (!d) return
    if (d.status === 'verified') { setStage('done'); onDone?.(d); onToast?.(`Verified at ${d.school}`); return }
    setStage('code')
  }

  const confirm = async (e) => {
    e.preventDefault()
    const d = await call({ action: 'confirm', code })
    if (!d) return
    setStage('done')
    onDone?.(d)
    onToast?.(`Verified at ${d.school}`)
  }

  const Mark = ({ s, big }) => (
    <span
      className={`school-mark ${big ? 'school-mark-big' : ''}`}
      style={{ '--c': s.color || 'var(--plum)', '--a': s.accent || 'var(--ink-soft)' }}
      aria-hidden="true"
    />
  )

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Verify your school" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {stage === 'school' && (
          <>
            <h2 className="sheet-name post-title">Where do you go?</h2>
            <p className="micro post-sub">
              Verifying a school address lets you see campus-only posts from groups at your
              university. It doesn’t show your address to anyone.
            </p>
            <ul className="school-list">
              {schools.map((s) => (
                <li key={s.domain}>
                  <button type="button" className="school-row" onClick={() => pick(s)}>
                    <Mark s={s} />
                    <span className="school-name">{s.name}</span>
                    <span className="micro school-domain">{s.domain}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {stage === 'address' && school && (
          <>
            <h2 className="sheet-name post-title">
              <Mark s={school} big />
              {school.name}
            </h2>
            <p className="micro post-sub">
              Your <strong>{school.domain}</strong> address — we’ll send a six-digit code to it.
            </p>
            <form onSubmit={start}>
              <label className="micro block-label" htmlFor="ver-email">School email</label>
              <input
                id="ver-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={`you@${school.domain}`}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}
              <button type="submit" className="btn-primary post-submit" disabled={busy || !email}>
                {busy ? 'Checking…' : 'Send me a code'}
              </button>
              <button
                type="button"
                className="pill verify-back"
                onClick={() => { setStage('school'); setSchool(null); setErr(null) }}
              >
                Different school
              </button>
            </form>
          </>
        )}

        {stage === 'code' && (
          <>
            <h2 className="sheet-name post-title">Check your inbox</h2>
            <p className="micro post-sub">
              We sent a six-digit code to <strong>{email}</strong>. It’s good for 15 minutes.
            </p>
            <form onSubmit={confirm}>
              <label className="micro block-label" htmlFor="ver-code">The code</label>
              <input
                id="ver-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength="6"
                className="code-input"
                placeholder="000000"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}
              <button type="submit" className="btn-primary post-submit" disabled={busy || code.length < 6}>
                {busy ? 'Checking…' : 'Verify'}
              </button>
              <button
                type="button"
                className="pill verify-back"
                onClick={() => { setStage('address'); setCode(''); setErr(null) }}
              >
                Use a different address
              </button>
            </form>
          </>
        )}

        {stage === 'done' && (
          <>
            <h2 className="sheet-name post-title">You’re in.</h2>
            <p className="micro post-sub">
              Verified at {school?.name}. Campus-only posts from groups there will show up on
              your map alongside everything else.
            </p>
            <button type="button" className="btn-primary post-submit" onClick={onClose}>Done</button>
          </>
        )}
      </section>
    </div>
  )
}
