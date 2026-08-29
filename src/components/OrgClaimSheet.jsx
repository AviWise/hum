import { useState } from 'react'
import { supa } from '../lib/supa.js'
import { useEscape } from '../lib/escape'
import { useSheetExit } from '../lib/sheet-exit'

// Claiming an org is a request, not an act. Nothing here grants anything —
// the row lands in org_claims with reviewed_at null, and a person reads it.
// That is deliberate: nothing automatic can tell whether someone actually runs
// GUSA, and an org account that anyone can mint is worth less than none.

const SCHOOLS = [
  { domain: 'gwu.edu', name: 'George Washington' },
  { domain: 'georgetown.edu', name: 'Georgetown' },
  { domain: 'howard.edu', name: 'Howard' },
  { domain: 'american.edu', name: 'American' },
  { domain: 'umd.edu', name: 'Maryland' },
  { domain: 'cua.edu', name: 'Catholic' },
  { domain: 'gallaudet.edu', name: 'Gallaudet' },
  { domain: 'trinitydc.edu', name: 'Trinity Washington' },
  { domain: 'udc.edu', name: 'UDC' },
  { domain: 'marymount.edu', name: 'Marymount' },
  { domain: 'gmu.edu', name: 'George Mason' },
]

export default function OrgClaimSheet({ onClose: rawClose, onToast }) {
  const { closing, onClose } = useSheetExit(rawClose)
  useEscape(onClose)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState(SCHOOLS[0].domain)
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const org_name = name.trim()
    if (org_name.length < 2) { setErr('What’s the group called?'); return }
    setBusy(true)
    setErr(null)
    const { error } = await supa.from('org_claims').insert({
      org_name, school_domain: domain, evidence: evidence.trim() || null,
    })
    setBusy(false)
    if (error) {
      // the one-open-claim index is a feature, so say so plainly
      setErr(error.code === '23505'
        ? 'You’ve already got a claim waiting — we’ll come back to that one.'
        : 'That didn’t send. Try again in a moment.')
      return
    }
    setSent(true)
    onToast?.('Claim filed — we’ll be in touch')
  }

  return (
    <div className={`sheet-scrim ${closing ? 'sheet-leaving' : ''}`} onClick={onClose}>
      <section className="sheet sheet-post-form" role="dialog" aria-label="Claim a student org" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        {sent ? (
          <>
            <h2 className="sheet-name post-title">Filed.</h2>
            <p className="micro post-sub">
              Someone reads every claim by hand — that’s the only way to keep a group’s
              name from being taken by someone who doesn’t run it. You’ll hear back.
            </p>
            <button type="button" className="btn-primary post-submit" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <h2 className="sheet-name post-title">Run a student org?</h2>
            <p className="micro post-sub">
              Claim it and your group posts as itself — its own page, its own events on the map.
              Heads up: <strong>this account becomes the group’s account</strong>, so if you’d
              rather keep a personal profile, sign up for the group separately and claim from there.
            </p>
            <form onSubmit={submit}>
              <label className="micro block-label" htmlFor="org-name">The group</label>
              <input
                id="org-name"
                type="text"
                maxLength="60"
                placeholder="Night Owls Film Society"
                value={name}
                onChange={(e) => { setName(e.target.value); setErr(null) }}
              />

              <label className="micro block-label" htmlFor="org-school">School</label>
              <div className="select-wrap">
                <select id="org-school" value={domain} onChange={(e) => setDomain(e.target.value)}>
                  {SCHOOLS.map((s) => <option key={s.domain} value={s.domain}>{s.name}</option>)}
                </select>
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>

              <label className="micro block-label" htmlFor="org-evidence">Something that shows it’s yours</label>
              <textarea
                id="org-evidence"
                rows="2"
                maxLength="300"
                placeholder="Your org’s page on the school site, its Instagram, your role…"
                value={evidence}
                onChange={(e) => { setEvidence(e.target.value); setErr(null) }}
              />
              {err && <p className="form-err" role="alert">{err}</p>}

              <p className="micro claim-note">
                Right now every org post is public to the whole city. Members-only and
                campus-only posting arrives with .edu verification — until then, don’t
                put anything here you wouldn’t put on a flyer.
              </p>
              <button type="submit" className="btn-primary post-submit" disabled={busy}>
                {busy ? 'Sending…' : 'File the claim'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
