import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES, liveBusy, CALENDAR, SUNSET } from '../data/spots.js'
import { RightNow } from './Tonight.jsx'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'
import { supa, SUPA_URL, SUPA_KEY } from '../lib/supa.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))
const LINE_DOTS = { rd: '#B34A56', or: '#D28A3C', yl: '#CFAC46', gr: '#4E9163', bl: '#4E7FA3', sv: '#989184' }

const skyWord = (code) => {
  if (code === 0) return 'clear'
  if (code <= 2) return 'mostly clear'
  if (code === 3) return 'overcast'
  if (code <= 48) return 'foggy'
  if (code <= 67) return 'drizzly'
  if (code <= 77) return 'snowing'
  if (code <= 82) return 'showery'
  return 'stormy'
}

const timeAgo = (ts, now) => {
  const m = Math.max(1, Math.round((now - ts) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

const fmtH = (h) => {
  const hh = Math.floor(h) % 24
  const mm = Math.round((h % 1) * 60)
  const ap = hh >= 12 ? 'pm' : 'am'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')}${ap}`
}

export default function TonightPage({ events, now, activeCats, onOpenSpot, onOpenProfile }) {
  const [wx, setWx] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [wire, setWire] = useState([])

  // live desk: weather (Open-Meteo, no key), Metro incidents, latest posts
  useEffect(() => {
    let dead = false
    const weather = () =>
      fetch('https://api.open-meteo.com/v1/forecast?latitude=38.9&longitude=-77.03&current=temperature_2m,weather_code&temperature_unit=fahrenheit')
        .then((r) => r.json())
        .then((d) => { if (!dead && d.current) setWx({ t: Math.round(d.current.temperature_2m), code: d.current.weather_code }) })
        .catch(() => {})
    const metro = () =>
      fetch(`${SUPA_URL}/functions/v1/metro-alerts`, { headers: { Authorization: `Bearer ${SUPA_KEY}` } })
        .then((r) => r.json())
        .then((d) => { if (!dead) setAlerts(d.alerts || []) })
        .catch(() => { if (!dead) setAlerts([]) })
    const posts = () =>
      supa.from('posts').select('id, spot_id, title, created_at, username').order('created_at', { ascending: false }).limit(8)
        .then(({ data }) => { if (!dead && data) setWire(data) })
    weather(); metro(); posts()
    const t = setInterval(() => { weather(); metro(); posts() }, 5 * 60 * 1000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  const d = new Date(now)
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
  const dateLine = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase()
  const sunsetH = SUNSET[d.getMonth()]
  const beforeSunset = d.getHours() + d.getMinutes() / 60 < sunsetH
  const topLive = Math.max(...SPOTS.map((s) => liveBusy(s, now)))
  const evening = d.getHours() >= 17 || d.getHours() < 5
  const mood = topLive >= 70 ? `A big ${dayName} ${evening ? 'night' : ''}` : topLive >= 40 ? `A steady ${dayName}` : `A quiet ${dayName}`

  const live = events.filter((e) => !e.dying && bySpot[e.spotId]).sort((a, b) => a.endsAt - b.endsAt)
  const withImg = (ev) => EVENT_PHOTOS[ev.id]?.src || ev.img || (ev.id.startsWith('u') ? null : spotPhoto(ev.spotId)?.src)
  // hero: the biggest live story with a picture
  const hero = [...live].filter(withImg).sort((a, b) => liveBusy(bySpot[b.spotId], now) - liveBusy(bySpot[a.spotId], now))[0]
  const board = live.filter((e) => e !== hero)

  // the regulars: recurring rituals over the next three days
  const regulars = []
  for (let off = 1; off <= 3 && regulars.length < 5; off++) {
    const day = (d.getDay() + off) % 7
    const label = new Date(now + off * 86400000).toLocaleDateString('en-US', { weekday: 'long' })
    for (const ev of CALENDAR) {
      if (ev.day === null || ev.day === undefined) continue
      const days = Array.isArray(ev.day) ? ev.day : [ev.day]
      if (!days.includes(day)) continue
      if (ev.month !== undefined && !(Array.isArray(ev.month) ? ev.month : [ev.month]).includes(d.getMonth())) continue
      if (regulars.some((r) => r.title === ev.title)) continue
      regulars.push({ label, title: ev.title.split(' — ')[0], spotId: ev.spotId })
      if (regulars.length >= 5) break
    }
  }

  return (
    <section className="page" aria-label="Tonight">
      <div className="tp-news">
        <div className="tp-main">
          <header className="tp-masthead">
            <p className="micro tp-dateline">
              {dayName.toLowerCase()} · {dateLine}
              {wx && <> · {wx.t}° and {skyWord(wx.code)}</>}
              {' '}· sunset {fmtH(sunsetH)}
            </p>
            <h2 className="tp-headline">{mood.trim()}{beforeSunset ? ' — golden hour is coming' : evening ? ' in the District' : ' so far'}</h2>
          </header>

          {hero && (
            <article className="tp-hero" onClick={() => onOpenSpot(hero.spotId)}>
              <img className="tp-hero-img" src={withImg(hero)} alt="" />
              <div className="tp-hero-shade" aria-hidden="true" />
              <div className="tp-hero-text">
                <p className="micro tp-hero-kicker">
                  <span className="tp-live-dot" aria-hidden="true" />
                  {bySpot[hero.spotId].name} · {timeLeft(hero.endsAt, now)} left
                </p>
                <h3 className="tp-hero-title">{hero.title}</h3>
                {hero.by && (
                  <button className="micro tp-hero-by" onClick={(e) => { e.stopPropagation(); onOpenProfile(hero.by) }}>@{hero.by}</button>
                )}
              </div>
            </article>
          )}

          <p className="micro tp-kicker">On the board</p>
          {board.length === 0 && !hero ? (
            <p className="empty-line">Quiet for now — be the first to post.</p>
          ) : (
            <ul className="tp-rows">
              {board.map((ev) => {
                const spot = bySpot[ev.spotId]
                const cat = CATEGORIES[spot.cat]
                const img = withImg(ev)
                const closing = ev.endsAt - now < 30 * 60000
                return (
                  <li key={ev.id} className={`tp-row ${ev.dying ? 'dying' : ''}`}>
                    <button className="tp-row-hit" onClick={() => onOpenSpot(spot.id)}>
                      {img
                        ? <img className="tp-row-img" src={img} alt="" loading="lazy" />
                        : <span className="tp-row-band" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.deep})` }} aria-hidden="true" />}
                      <span className="tp-row-body">
                        <span className="tp-row-title">{ev.title}</span>
                        <span className="micro tp-row-meta">
                          <span style={{ color: cat.deep }}>{spot.name}</span>
                          {ev.by && (
                            <>
                              {' · '}
                              <span className="ev-by-link" role="button" tabIndex="0"
                                onClick={(e) => { e.stopPropagation(); onOpenProfile(ev.by) }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenProfile(ev.by) } }}>
                                @{ev.by}
                              </span>
                            </>
                          )}
                          <span className={`countdown tp-row-left ${closing ? 'closing' : ''}`}>{timeLeft(ev.endsAt, now)} left</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="micro tp-kicker">Metro notes</p>
          {alerts === null ? (
            <p className="empty-line">Checking the lines…</p>
          ) : alerts.length === 0 ? (
            <p className="tp-metro-ok">All six lines moving normally.</p>
          ) : (
            <ul className="tp-alerts">
              {alerts.map((a, i) => (
                <li key={i}>
                  <span className="train-transfers">
                    {a.lines.map((l) => <span key={l} className="pop-line-dot" style={{ background: LINE_DOTS[l] || '#989184' }} />)}
                  </span>
                  <p>{a.desc}</p>
                </li>
              ))}
            </ul>
          )}

          {regulars.length > 0 && (
            <>
              <p className="micro tp-kicker">The regulars</p>
              <ul className="tp-regulars">
                {regulars.map((r, i) => (
                  <li key={i}>
                    <button className="tp-reg-hit" onClick={() => onOpenSpot(r.spotId)}>
                      <span className="micro tp-reg-day">{r.label.toLowerCase()}</span>
                      <span className="tp-reg-title">{r.title}</span>
                      <span className="micro tp-reg-spot">{bySpot[r.spotId]?.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <aside className="tp-rail">
          <RightNow activeCats={activeCats} at={now} count={8} className="rightnow-page" onOpenSpot={onOpenSpot} />

          <div className="tp-wire">
            <p className="micro tp-kicker">The wire</p>
            {(() => {
              // real dispatches first; the live board fills in while the town warms up
              const items = [
                ...wire.map((p) => ({ key: p.id, when: timeAgo(Date.parse(p.created_at), now), title: p.title, spotId: p.spot_id, by: p.username })),
                ...(wire.length < 4
                  ? live.filter((e) => !wire.some((w) => w.title === e.title)).slice(0, 6 - wire.length)
                      .map((e) => ({ key: e.id, when: 'live', title: e.title, spotId: e.spotId, by: e.by }))
                  : []),
              ].slice(0, 8)
              if (items.length === 0) return <p className="empty-line">No dispatches yet.</p>
              return (
                <ul>
                  {items.map((p) => (
                    <li key={p.key}>
                      <button className="tp-wire-hit" onClick={() => onOpenSpot(p.spotId)}>
                        <span className="micro tp-wire-when">{p.when}</span>
                        <span className="tp-wire-title">{p.title}</span>
                        <span className="micro tp-wire-spot">{bySpot[p.spotId]?.name || p.spotId}{p.by ? ` · @${p.by}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        </aside>
      </div>
    </section>
  )
}
