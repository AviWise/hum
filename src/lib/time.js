export function timeLeft(endsAt, now) {
  const ms = Math.max(0, endsAt - now)
  const m = Math.floor(ms / 60000)
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
  if (m >= 1) return `${m}m`
  return `${Math.ceil(ms / 1000)}s`
}

export function clockLine(now) {
  const d = new Date(now)
  const day = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '')
  return `${day} · ${t}`
}
