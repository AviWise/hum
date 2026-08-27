import { useState } from 'react'
import { supa } from '../lib/supa.js'
import { markReported } from '../lib/reported.js'

// Two taps, so a thumb never reports by accident. The post vanishes for this
// person the moment the second tap lands, whatever the server says.
export default function ReportButton({ postId, authed, onNeedAccount, className = '' }) {
  const [armed, setArmed] = useState(false)

  const go = async (e) => {
    e.stopPropagation()
    if (!authed) { onNeedAccount?.(); return }
    if (!armed) { setArmed(true); return }
    setArmed(false)
    markReported(postId)
    const { error } = await supa.from('reports').insert({ post_id: postId })
    if (error && error.code !== '23505') { /* already hidden for them either way */ }
  }

  // Reporting is rare and shouldn't hold permanent space next to content: it
  // hides behind a quiet ⋯ until someone goes looking for it.
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        type="button"
        className={`report-more ${className}`}
        aria-label="More options"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.2" cy="8" r="1.15" fill="currentColor" />
          <circle cx="8" cy="8" r="1.15" fill="currentColor" />
          <circle cx="12.8" cy="8" r="1.15" fill="currentColor" />
        </svg>
      </button>
    )
  }
  return (
    <button
      type="button"
      className={`report-btn ${armed ? 'report-armed' : ''} ${className}`}
      onClick={go}
      onBlur={() => { if (!armed) setOpen(false) }}
      autoFocus
    >
      {armed ? 'tap again to report' : 'report'}
    </button>
  )
}
