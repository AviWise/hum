import { useEffect, useState } from 'react'
import { supa } from '../lib/supa.js'

// Prove you go there. Two screens at most: the address, then the code — and
// often not even that, because an account that signed in with its school
// address has already proved the thing we're asking about.
//
// Nothing here decides anything. Every answer comes from the school-verify
// function; the client has no policy that lets it write a verification.
export default function SchoolVerifySheet({ onClose, onDone, onToast }) {
  const [schools, setSchools] = useState([])
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('address') // address | code | done
  const [school, setSchool] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supa.from('schools').select('domain, name').order('sort').then(({ data }) => setSchools(data || []))
    // prefill with the address they already signed in with — for a lot of
    // students that is the school address, and this finishes in one tap
    supa.auth.getUser().then(({ data }) => { if (data?.user?.email) setEmail(data.user.email) })
  }, [])

  const call = async (body) => {
    setBusy(true)
    setErr(null)
    const { data, error } = await supa.functions.invoke('school-verify', { body })
    setBusy(false)
    if (error) {
      // the function's own message is the useful one; dig it out of the failure
      let msg = 'That didn’t go through. Try again in a moment.'
      try { msg = (await error.context?.json())?.error || msg } catch { /* keep the fallback */ }
      setErr(msg)
      return null
    }
    if (data?.error) { setErr(data.error); return null }
    return data
  }

  const start = async (e) => {
    e.preventDefault()
    const d = await call({ action: 'start', email })
    if (!d) return
    setSchool(d.school)
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

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Verify your school" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {stage === 'address' && (
          <>
            <h2 className="sheet-name post-title">Which school?</h2>
            <p className="micro post-sub">
              Verifying your school address lets you see campus-only posts from groups at
              your university. It doesn’t show your address to anyone.
            </p>
            <form onSubmit={start}>
              <label className="micro block-label" htmlFor="ver-email">Your school email</label>
              <input
                id="ver-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@gwu.edu"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}
              {schools.length > 0 && (
                <p className="micro aud-note">
                  Covering {schools.map((s) => s.name).join(', ')}.
                </p>
              )}
              <button type="submit" className="btn-primary post-submit" disabled={busy || !email}>
                {busy ? 'Checking…' : 'Continue'}
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
              Verified at {school}. Campus-only posts from groups there will show up on
              your map alongside everything else.
            </p>
            <button type="button" className="btn-primary post-submit" onClick={onClose}>Done</button>
          </>
        )}
      </section>
    </div>
  )
}
