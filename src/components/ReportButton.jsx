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

  return (
    <button
      type="button"
      className={`report-btn ${armed ? 'report-armed' : ''} ${className}`}
      onClick={go}
    >
      {armed ? 'tap again to report' : 'report'}
    </button>
  )
}
