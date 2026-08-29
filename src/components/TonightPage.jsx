import { useEffect, useState } from 'react'
import { SPOTS, CATEGORIES, liveBusy, CALENDAR, SUNSET, eveningPeakHour } from '../data/spots.js'
import { markEventsSeen, isNewToYou } from '../lib/seen.js'
import { RightNow } from './Tonight.jsx'
import { eventsOnDay, isArena, arenaHeat, VENUE_INFO } from '../data/venueinfo.js'
import { EVENT_PHOTOS, spotPhoto } from '../data/photos.js'
import { timeLeft } from '../lib/time.js'
import { supa, SUPA_URL, SUPA_KEY } from '../lib/supa.js'
import { mid, srcSetOf, dimsOf } from '../lib/img.js'

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

// "22:00" -> "10pm", for venue line-ups that carry a real start time
const fmtT = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return m ? `${hr}:${String(m).padStart(2, '0')}${ampm}` : `${hr}${ampm}`
}
const fmtH = (h) => {
  const hh = Math.floor(h) % 24
  const mm = Math.round((h % 1) * 60)
  const ap = hh >= 12 ? 'pm' : 'am'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')}${ap}`
}

export default function TonightPage({ events, now, activeCats, onOpenSpot, onOpenProfile, boosts}) {
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
      supa.from('posts').select('id, spot_id, title, created_at, username, place_name, is_demo').order('created_at', { ascending: false }).limit(8)
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

  const live = events.filter((e) => !e.dying && bySpot[e.spotId]).sort((a, b) => a.endsAt - b.endsAt)
  const withImg = (ev) => EVENT_PHOTOS[ev.id]?.src || ev.img || (ev.id.startsWith('u') ? null : spotPhoto(ev.spotId)?.src)

  // The page used to mix these together and call all of it news, which is why
  // the same items showed up day after day: the seeded calendar regenerates
  // every morning. Someone posting right now and "there is always jazz here on
  // Thursdays" are different kinds of fact and belong in different places.
  // A dated one-off belongs with tonight's news, not in the weekly fold —
  // "the goats are back" happens once and is exactly the sort of thing this
  // page exists to tell you.
  const posted = live.filter((e) => e.id.startsWith('u-') || e.once)
  const usual = live.filter((e) => !e.id.startsWith('u-') && !e.once)
  const cadence = (ev) => {
    if (ev.everyday) return 'most days'
    const names = (ev.days || []).map((n) => ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][n])
    return names.length > 2 ? 'most nights' : names.length === 2 ? names.join(' & ') : `every ${names[0]?.slice(0, -1) || dayName}`
  }
  const fresh = posted.filter((e) => isNewToYou(e.id))

  // Real venue line-ups for tonight. The page had no idea these existed and
  // was telling people "nothing one-off tonight" while three rooms had shows
  // on — the spot sheets knew, this page did not.
  const listed = eventsOnDay(now)
  const listedShows = listed.filter((e) => !isArena(e.venue))
  const listedFixtures = listed.filter((e) => isArena(e.venue))

  // The headline used to grade the night on busyness alone, which is a forecast
  // curve — so it could announce "A big Friday night" over a page that went on
  // to say nothing was on and nobody had posted. It now weighs what is actually
  // happening, and busyness is only one of the four things it counts.
  //
  // A fixture outranks the grade entirely: 41,000 people at Nats Park is not a
  // mood, it is the headline.
  const bigness =
      (topLive >= 70 ? 2 : topLive >= 40 ? 1 : 0)
    + (listedShows.length >= 5 ? 2 : listedShows.length >= 2 ? 1 : 0)
    + (posted.length >= 5 ? 2 : posted.length >= 1 ? 1 : 0)
  const grade = bigness >= 4 ? `A big ${dayName} ${evening ? 'night' : ''}`
    : bigness >= 2 ? `A steady ${dayName}`
    : `A quiet ${dayName}`
  // When there is a fixture, the fixture IS the headline — say what it is
  // rather than grading the evening around it. "is full tonight" was an
  // overclaim (nothing here knows about ticket sales) and the suffix below
  // turned it into "Nats Park is full tonight in the District".
  //
  // Not EVERY fixture, though. Gated on arenaHeat — the same number that heats
  // the map — so a fixture only takes the headline while it is actually
  // dominating the city. A minor-league soccer match at Audi Field was
  // outranking a busy Friday with seven shows on; 41,000 at Nats Park does not.
  const clip = (t, n = 46) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n)) + '…')
  const marquee = listedFixtures.find((e) => arenaHeat(VENUE_INFO[e.venue]?.spot, now) >= 25)
  const headline = marquee
    ? clip(marquee.title)
    : `${grade.trim()}${beforeSunset ? ' — golden hour is coming' : evening ? ' in the District' : ' so far'}`

  // A hero has to earn the space. Only something posted tonight, with a
  // picture, that you have not already been shown — otherwise the page leads
  // with the list and nothing pretends to be breaking news.
  const hero = fresh.filter(withImg)
    .sort((a, b) => liveBusy(bySpot[b.spotId], now) - liveBusy(bySpot[a.spotId], now))[0]
  const board = posted.filter((e) => e !== hero)

  // mark what this render actually showed, so tomorrow knows
  useEffect(() => {
    const t = setTimeout(() => markEventsSeen(posted.map((e) => e.id)), 1500)
    return () => clearTimeout(t)
  }, [posted.map((e) => e.id).join(',')])

  // If nothing one-off is on, the regulars ARE the answer to "what's going on"
  // — folding them away then leaves a blank page pretending to be a quiet one.
  const [showUsual, setShowUsual] = useState(posted.length === 0)

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
            <h2 className="tp-headline">{headline}</h2>
            {/* orientation before ornament: say what is on this page and how
                much of it is actually new, or nobody can tell either */}
            <p className="tp-orient">
              {posted.length === 0
                ? [
                    listed.length ? `${listed.length} ${listed.length === 1 ? 'show' : 'shows'} on tonight` : null,
                    'nobody\'s posted yet',
                    usual.length ? `${usual.length} regular ${usual.length === 1 ? 'thing' : 'things'} on a ${dayName}` : null,
                  ].filter(Boolean).join(' · ')
                : <>
                    <strong>{posted.length}</strong> posted tonight
                    {fresh.length > 0 && <> · <strong>{fresh.length}</strong> new since you looked</>}
                    {usual.length > 0 && <> · {usual.length} regular {usual.length === 1 ? 'thing' : 'things'}</>}
                  </>}
            </p>
          </header>

          {hero && (
            <article className="tp-hero tp-hero-short" onClick={() => onOpenSpot(hero.spotId)}>
              <img
                className="tp-hero-img"
                src={withImg(hero)}
                srcSet={srcSetOf(withImg(hero))}
                sizes="(min-width: 900px) 640px, 100vw"
                width={dimsOf(withImg(hero))?.[0]}
                height={dimsOf(withImg(hero))?.[1]}
                alt=""
              />
              <div className="tp-hero-shade" aria-hidden="true" />
              <div className="tp-hero-text">
                <p className="micro tp-hero-kicker">
                  <span className="tp-live-dot" aria-hidden="true" />
                  New · {bySpot[hero.spotId].name} · {timeLeft(hero.endsAt, now)} left
                </p>
                <h3 className="tp-hero-title">{hero.title}</h3>
                {(!hero.id.startsWith('u-') || hero.demo) && <span className="demo-tag demo-tag-on-photo micro">Demo</span>}
                {hero.by && (
                  <button className="micro tp-hero-by" onClick={(e) => { e.stopPropagation(); onOpenProfile(hero.by) }}>@{hero.by}</button>
                )}
              </div>
            </article>
          )}

          {listedShows.length > 0 && (
            <>
              <p className="micro tp-kicker">On at the venues</p>
              <ul className="tp-listed">
                {listedShows.map((e, i) => (
                  <li key={e.venue + e.time + i}>
                    <button className="tp-listed-hit" onClick={() => onOpenSpot(VENUE_INFO[e.venue]?.spot)}>
                      <span className="tp-listed-time">{fmtT(e.time)}</span>
                      <span className="tp-listed-body"><strong>{e.venue}</strong> · {e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {listedFixtures.length > 0 && (
            <>
              <p className="micro tp-kicker">Games</p>
              <ul className="tp-listed">
                {listedFixtures.map((e, i) => (
                  <li key={e.venue + e.time + i}>
                    <button className="tp-listed-hit" onClick={() => onOpenSpot(VENUE_INFO[e.venue]?.spot)}>
                      <span className="tp-listed-time">{fmtT(e.time)}</span>
                      <span className="tp-listed-body"><strong>{e.venue}</strong> · {e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="micro tp-kicker">Happening tonight</p>
          {board.length === 0 && !hero ? (
            <p className="empty-line">
              {listed.length
                ? 'Nobody’s posted yet — you’d be the first. The rooms’ line-ups are above.'
                : 'Nothing one-off tonight and nobody’s posted yet — you’d be the first. What’s usually on is below.'}
            </p>
          ) : (
            <ul className="tp-rows">
              {board.map((ev) => {
                const spot = bySpot[ev.spotId]
                const cat = CATEGORIES[spot.cat]
                const img = withImg(ev)
                const closing = ev.endsAt - now < 30 * 60000
                return (
                  <li key={ev.id} className={`tp-row ${ev.dying ? 'dying' : ''} ${isNewToYou(ev.id) ? 'tp-row-new' : ''}`}>
                    <button className="tp-row-hit" onClick={() => onOpenSpot(spot.id)}>
                      {img
                        ? <img className="tp-row-img" src={mid(img)} alt="" loading="lazy" />
                        : <span className="tp-row-band" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.deep})` }} aria-hidden="true" />}
                      <span className="tp-row-body">
                        <span className="tp-row-title">
                          {isNewToYou(ev.id) && <span className="tp-new micro">New</span>}
                          {ev.title}
                          {ev.once && <span className="tp-once micro">Tonight only</span>}
                          {(!ev.id.startsWith('u-') || ev.demo) && <span className="demo-tag micro">Demo</span>}
                        </span>
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

          {usual.length > 0 && (
            <>
              <button className="tp-kicker tp-fold micro" onClick={() => setShowUsual((v) => !v)}>
                What’s usually on a {dayName}
                <span className="tp-fold-count">{usual.length}</span>
                <svg viewBox="0 0 12 12" aria-hidden="true" className={showUsual ? 'tp-fold-open' : ''}>
                  <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {/* Folded by default, because these are the same every week and
                  showing them as news is what made the page feel stale. */}
              {showUsual && (
                <ul className="tp-rows tp-rows-quiet">
                  {usual.map((ev) => {
                    const spot = bySpot[ev.spotId]
                    const cat = CATEGORIES[spot.cat]
                    return (
                      <li key={ev.id} className="tp-row">
                        <button className="tp-row-hit" onClick={() => onOpenSpot(spot.id)}>
                          <span className="tp-row-band" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.deep})` }} aria-hidden="true" />
                          <span className="tp-row-body">
                            <span className="tp-row-title">{ev.title}</span>
                            <span className="micro tp-row-meta">
                              <span style={{ color: cat.deep }}>{spot.name}</span>
                              <span className="countdown tp-row-left">{cadence(ev)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
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
          <RightNow activeCats={activeCats} at={now} boosts={boosts} count={8} className="rightnow-page" onOpenSpot={onOpenSpot} />

          <div className="tp-wire">
            <p className="micro tp-kicker">The wire</p>
            {(() => {
              // real dispatches first; the live board fills in while the town warms up
              const items = [
                ...wire.map((p) => ({ key: p.id, when: timeAgo(Date.parse(p.created_at), now), title: p.title, spotId: p.spot_id, placeName: p.place_name, by: p.username, demo: p.is_demo === true })),
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
                      <button className="tp-wire-hit" onClick={() => p.spotId && bySpot[p.spotId] && onOpenSpot(p.spotId)}>
                        <span className="micro tp-wire-when">{p.when === 'live' ? 'now' : p.when}</span>
                        <span className="tp-wire-title">{p.title}{p.demo && <span className="demo-tag micro">Demo</span>}</span>
                        <span className="micro tp-wire-spot">
                          {p.when === 'live' && <span className="pill-dot dot-live" style={{ background: CATEGORIES[bySpot[p.spotId]?.cat || 'niche'].color }} aria-hidden="true" />}
                          {bySpot[p.spotId]?.name || p.placeName || 'out there'}{p.by ? ` · @${p.by}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </div>
        </aside>
      </div>
      <StoppingLine now={now} />
    </section>
  )
}

// An honest end to the page: what's here is all there is, and when more
// usually arrives — the hour comes from the foot-traffic evening peak for
// this weekday, not a guess.
export function StoppingLine({ now }) {
  const peak = eveningPeakHour(now)
  const past = peak !== null && new Date(now).getHours() >= peak
  const label = peak === null ? null : (peak % 12 === 0 ? 12 : peak % 12)
  return (
    <p className="stopping-line">
      That’s everything live right now.
      {label !== null && !past && ` More usually lands around ${label}.`}
    </p>
  )
}
