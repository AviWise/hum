import { useEffect, useState } from 'react'
import { supa, SUPA_URL, SUPA_KEY } from '../lib/supa.js'

// The auth settings endpoint is public; we use it to show the Google button
// only once the provider is actually switched on server-side.
let googleKnown = null
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

const friendly = (msg) => {
  if (/already registered/i.test(msg)) return 'That email already has an account — sign in instead.'
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match.'
  if (/at least 6/i.test(msg) || /password/i.test(msg)) return 'Passwords need at least 6 characters.'
  if (/valid email/i.test(msg) || /invalid format/i.test(msg)) return 'That doesn’t look like an email address.'
  if (/rate limit/i.test(msg)) return 'Too many tries — give it a minute.'
  return msg
}

export default function AccountSheet({ profile, onClose, onAuthed, intent }) {
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [uname, setUname] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [google, setGoogle] = useState(googleKnown === true)

  useEffect(() => {
    if (googleKnown !== null) return
    fetch(`${SUPA_URL}/auth/v1/settings`, { headers: { apikey: SUPA_KEY } })
      .then((r) => r.json())
      .then((d) => { googleKnown = !!d.external?.google; setGoogle(googleKnown) })
      .catch(() => {})
  }, [])

  const googleIn = () => {
    supa.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (mode === 'signup') {
      const u = uname.trim().toLowerCase()
      if (!USERNAME_RE.test(u)) {
        setErr('Usernames are 3–20 characters — letters, numbers, dots, underscores.')
        return
      }
      setBusy(true)
      const { data: taken } = await supa.from('profiles').select('id').eq('username', u).maybeSingle()
      if (taken) { setBusy(false); setErr('That username’s taken — try another.'); return }
      const { error } = await supa.auth.signUp({ email: email.trim(), password: pass, options: { data: { username: u } } })
      setBusy(false)
      if (error) { setErr(friendly(error.message)); return }
      onAuthed()
    } else {
      setBusy(true)
      const { error } = await supa.auth.signInWithPassword({ email: email.trim(), password: pass })
      setBusy(false)
      if (error) { setErr(friendly(error.message)); return }
      onAuthed()
    }
  }

  const signOut = async () => {
    await supa.auth.signOut()
    onClose()
  }

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Your account" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />

        {profile ? (
          <>
            <h2 className="sheet-name post-title">@{profile.username}</h2>
            <p className="micro post-sub">Signed in — your username rides along on everything you post.</p>
            <button type="button" className="btn-primary post-submit" onClick={onClose}>Back to the map</button>
            <button type="button" className="acct-signout" onClick={signOut}>sign out</button>
          </>
        ) : (
          <>
            <h2 className="sheet-name post-title">{intent ? 'One thing first' : 'Who’s out?'}</h2>
            <p className="micro post-sub">
              {intent
                ? 'Posting needs an account, so the map stays honest.'
                : 'An account puts your name on what you post.'}
            </p>

            {google && (
              <>
                <button type="button" className="btn-google" onClick={googleIn}>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
                    <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853" />
                    <path d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" fill="#FBBC05" />
                    <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
                <p className="micro acct-or">or with email</p>
              </>
            )}

            <div className="acct-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={mode === 'signup'} className={`pill ${mode === 'signup' ? 'pill-on' : ''}`} onClick={() => { setMode('signup'); setErr(null) }}>
                new here
              </button>
              <button type="button" role="tab" aria-selected={mode === 'signin'} className={`pill ${mode === 'signin' ? 'pill-on' : ''}`} onClick={() => { setMode('signin'); setErr(null) }}>
                sign in
              </button>
            </div>

            <form onSubmit={submit}>
              {mode === 'signup' && (
                <>
                  <label className="micro block-label" htmlFor="acct-uname">Username</label>
                  <input
                    id="acct-uname"
                    className="acct-input"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck="false"
                    maxLength="20"
                    placeholder="how the map knows you"
                    value={uname}
                    onChange={(e) => { setUname(e.target.value); setErr(null) }}
                  />
                </>
              )}
              <label className="micro block-label" htmlFor="acct-email">Email</label>
              <input
                id="acct-email"
                className="acct-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErr(null) }}
              />
              <label className="micro block-label" htmlFor="acct-pass">Password</label>
              <input
                id="acct-pass"
                className="acct-input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength="6"
                value={pass}
                onChange={(e) => { setPass(e.target.value); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}
              <button type="submit" className="btn-primary post-submit" disabled={busy}>
                {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
