import { useEffect, useState } from 'react'
import { useEscape } from '../lib/escape'

const LINE_COLORS = { RD: '#B34A56', OR: '#D28A3C', YL: '#CFAC46', GR: '#4E9163', BL: '#4E7FA3', SV: '#989184' }
const CHIP_COLORS = { red: '#B34A56', orange: '#D28A3C', yellow: '#CFAC46', green: '#4E9163', blue: '#4E7FA3', silver: '#989184' }
const LINE_NAMES = { RD: 'Red', OR: 'Orange', YL: 'Yellow', GR: 'Green', BL: 'Blue', SV: 'Silver' }

export default function TrainSheet({ train, onClose }) {
  useEscape(onClose)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const color = LINE_COLORS[train.line] || '#989184'

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('https://hxmjszgvkynrwscelnzx.supabase.co/functions/v1/train-trip', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX',
      },
      body: JSON.stringify({ code: train.code, line: train.line, dest: train.dest, min: train.min }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.stops) { setData(d); setFailed(false) } else setFailed(true) })
      .catch((e) => { if (e.name !== 'AbortError') setFailed(true) })
    return () => ctrl.abort()
  }, [])

  const fmt = (t) =>
    new Date(t * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="Train details" onClick={(e) => e.stopPropagation()} style={{ '--line': color }}>
        <div className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head">
          <span className="train-line-dot" aria-hidden="true" />
          <div>
            <h2 className="sheet-name">{train.dest === 'LastTrain' ? 'Last train' : train.dest}</h2>
            <p className="micro sheet-area">
              {LINE_NAMES[train.line] || train.line} line · from {train.station}
              {train.min && <> · {train.min === 'BRD' ? 'boarding' : train.min === 'ARR' ? 'arriving' : `in ${train.min} min`}</>}
            </p>
          </div>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </header>

        {data?.alerts?.length > 0 && (
          <div className="train-alert">
            {data.alerts.map((a, i) => <p key={i}>{a}</p>)}
          </div>
        )}

        {failed && <p className="empty-line train-empty">Couldn’t match this train to its live trip — it may be about to board. Try the next one.</p>}
        {!data && !failed && <p className="empty-line train-empty">Finding this train…</p>}

        {data && (
          <ol className="train-rail">
            {data.stops.map((s, i) => (
              <li key={s.code + i} className="train-stop">
                <span className="train-stop-dot" aria-hidden="true" />
                <span className="train-stop-name">
                  {s.name}
                  {s.lines.length > 1 && (
                    <span className="train-transfers">
                      {s.lines.filter((l) => CHIP_COLORS[l] !== color).map((l) => (
                        <span key={l} className="pop-line-dot" style={{ background: CHIP_COLORS[l] }} title={l} />
                      ))}
                    </span>
                  )}
                </span>
                <span className="train-stop-time">{fmt(s.time)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
