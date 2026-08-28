import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { avatarHue, avatarInitial } from '../data/people.js'

// Two floating objects on phones: a pill for going places, a circle for doing
// the thing. On desktop the same markup lays out flat as the sidebar rail —
// .tabbar-pill becomes display:contents there, so the items flow straight in.
//
// The capsule behind the active tab is one element, not four backgrounds, so a
// thumb can grab it and drag along the row: it tracks the finger, the tab under
// it lights up, and letting go commits. Below the drag threshold nothing is
// captured and a tap stays an ordinary tap.

const ICONS = {
  map: (
    <>
      <path d="M7 3.5 3 5v11l4-1.5 6 2 4-1.5V4l-4 1.5-6-2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 3.5v11M13 5.5v11" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  tonight: (
    <>
      <path d="M15.5 12.5A6.3 6.3 0 0 1 7.4 4.4a6.3 6.3 0 1 0 8.1 8.1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 4.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="currentColor" />
    </>
  ),
  feed: (
    <>
      <rect x="3" y="3" width="6" height="8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.4" y="3" width="5.6" height="5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.4" y="10.4" width="5.6" height="6.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="13.4" width="6" height="3.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  you: (
    <>
      <circle cx="10" cy="7" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.8 17c1-3 3.4-4.5 6.2-4.5s5.2 1.5 6.2 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
}

const TABS = [
  { id: 'map', label: 'Map' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'feed', label: 'Feed' },
  { id: 'you', label: 'You' },
]

const DRAG_START = 6      // px of travel before a tap becomes a drag
const MAX_PULL = 84       // px of overshoot the capsule will stretch across
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const isPhoneNav = () => window.matchMedia('(max-width: 899px)').matches

export default function TabBar({ tab, onTab, onPost, onSearch, onMessages, onCommunity, unread = 0, clock, profile }) {
  const pillRef = useRef(null)
  const capRef = useRef(null)
  const metrics = useRef([])
  const drag = useRef({ down: false, moved: false, startX: 0, left: 0, index: 0 })
  // the tab under the thumb mid-drag; the row previews it before it commits
  const [preview, setPreview] = useState(null)
  const litIndex = TABS.findIndex((t) => t.id === (preview || tab))

  const measure = useCallback(() => {
    const pill = pillRef.current
    if (!pill) return false
    const base = pill.getBoundingClientRect()
    if (!base.width) return false
    metrics.current = TABS.map(({ id }) => {
      const el = pill.querySelector(`[data-tab="${id}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const left = r.left - base.left
      return { left, width: r.width, center: left + r.width / 2 }
    })
    return metrics.current.every(Boolean)
  }, [])

  // index → resting place. x (relative to the pill) → the capsule rides the
  // thumb instead, stretching rather than escaping once past either end.
  const paint = useCallback((index, x) => {
    const cap = capRef.current
    const m = metrics.current[index]
    if (!cap || !m) return
    let left = m.left
    let scale = 1
    let origin = '50% 50%'
    if (x != null) {
      const first = metrics.current[0]
      const last = metrics.current[metrics.current.length - 1]
      left = clamp(x, first.center, last.center) - m.width / 2
      const over = x < first.center ? x - first.center : x > last.center ? x - last.center : 0
      if (over) {
        // it gives, but only so far, and the pill clips whatever is left over
        scale = Math.min(1.28, 1 + (Math.min(Math.abs(over), MAX_PULL) / m.width) * 0.34)
        origin = over < 0 ? '100% 50%' : '0% 50%'   // stretch toward the thumb
      }
    }
    cap.style.width = `${m.width}px`
    cap.style.transformOrigin = origin
    cap.style.transform = `translateX(${left}px) scaleX(${scale})`
  }, [])

  const nearest = (x) => {
    let best = 0
    let dist = Infinity
    metrics.current.forEach((m, i) => {
      const d = Math.abs(m.center - x)
      if (d < dist) { dist = d; best = i }
    })
    return best
  }

  // settle the capsule wherever the route says it belongs
  const settled = useRef(false)
  useLayoutEffect(() => {
    const cap = capRef.current
    if (!cap) return
    if (litIndex < 0) { cap.style.opacity = '0'; return }
    if (!isPhoneNav()) return
    if (!measure()) return
    cap.style.opacity = '1'
    if (drag.current.down) return
    if (!settled.current) {
      // a cold load on #/feed should find the capsule there, not watch it
      // fly across the row on arrival
      settled.current = true
      cap.classList.add('tab-cap-drag')
      paint(litIndex, null)
      requestAnimationFrame(() => cap.classList.remove('tab-cap-drag'))
      return
    }
    paint(litIndex, null)
  }, [litIndex, measure, paint])

  // the pill changes width when it shrinks, so the capsule is re-measured from
  // the box itself rather than from a resize event — this also covers rotation
  // and late-loading fonts
  useEffect(() => {
    const pill = pillRef.current
    if (!pill || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!isPhoneNav() || drag.current.down || litIndex < 0) return
      if (measure()) paint(litIndex, null)
    })
    ro.observe(pill)
    return () => ro.disconnect()
  }, [litIndex, measure, paint])

  // Scrolling makes the nav recede — labels fold away, the pill loses height
  // and a little width. Reading is the foreground act; the nav can wait. It
  // comes back the instant you scroll up or reach the top.
  const [small, setSmall] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let lastTarget = null
    let lastTop = 0
    const onScroll = (e) => {
      const el = e.target
      const top = el === document || el === document.documentElement ? window.scrollY : el.scrollTop
      if (typeof top !== 'number') return
      if (el !== lastTarget) { lastTarget = el; lastTop = top; return }
      const dy = top - lastTop
      lastTop = top
      if (top < 24) setSmall(false)
      else if (dy > 4) setSmall(true)
      else if (dy < -6) setSmall(false)
    }
    // scroll does not bubble, but it does travel down the capture path, so one
    // listener covers whichever page is mounted
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])
  // a page swap starts you at the top, so the nav should be full size again
  useEffect(() => { setSmall(false) }, [tab])

  const onPointerDown = (e) => {
    if (!isPhoneNav() || (e.pointerType === 'mouse' && e.button !== 0)) return
    if (!measure()) return
    const base = pillRef.current.getBoundingClientRect()
    drag.current = {
      down: true, moved: false, startX: e.clientX, left: base.left,
      index: litIndex < 0 ? nearest(e.clientX - base.left) : litIndex,
    }
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d.down) return
    // a mouse released off the pill never reported up; do not resume on hover
    if (e.pointerType === 'mouse' && e.buttons === 0) { endDrag(false); return }
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < DRAG_START) return
      d.moved = true
      // capture only once it is really a drag, so taps keep their native click
      try { pillRef.current.setPointerCapture(e.pointerId) } catch { /* fine */ }
      capRef.current?.classList.add('tab-cap-drag')
    }
    const x = e.clientX - d.left
    const idx = nearest(x)
    if (idx !== d.index) {
      d.index = idx
      setPreview(TABS[idx].id)
      navigator.vibrate?.(6)
    }
    paint(idx, x)
  }

  const endDrag = (commit) => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    capRef.current?.classList.remove('tab-cap-drag')
    if (!d.moved) { setPreview(null); return }
    const next = TABS[d.index].id
    setPreview(null)
    paint(d.index, null)
    if (commit && next !== tab) onTab(next)
  }

  // a released drag must not also fire the click underneath it
  const onClickCapture = (e) => {
    if (!drag.current.moved) return
    drag.current.moved = false
    e.stopPropagation()
    e.preventDefault()
  }

  return (
    <nav className={`tabbar ${small ? 'nav-small' : ''}`} aria-label="Pages">
      <div className="side-brand">
        <span className="wordmark">hum<span className="wordmark-dot">.</span></span>
        <p className="micro">washington, d.c.</p>
      </div>

      <div
        className="tabbar-pill"
        ref={pillRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
        onClickCapture={onClickCapture}
      >
        <span className="tab-cap" ref={capRef} aria-hidden="true" />

        {TABS.map(({ id, label }) => {
          const isYou = id === 'you'
          const lit = (preview || tab) === id
          return (
            <button
              key={id}
              data-tab={id}
              className={`tab-item ${tab === id ? 'tab-on' : ''} ${lit ? 'tab-lit' : ''}`}
              aria-pressed={tab === id}
              aria-label={isYou ? (profile ? `Your profile — @${profile.username}` : 'Sign in') : undefined}
              onClick={() => onTab(id)}
            >
              {isYou && profile ? (
                <span
                  className="tab-ava"
                  style={{ '--ava-bg': `oklch(0.82 0.06 ${avatarHue(profile.username)})`, '--ava-ink': `oklch(0.42 0.09 ${avatarHue(profile.username)})` }}
                >
                  {avatarInitial(profile.username)}
                </span>
              ) : (
                <svg viewBox="0 0 20 20" aria-hidden="true">{ICONS[id]}</svg>
              )}
              <span className="tab-label">{label}</span>
            </button>
          )
        })}

        {/* desktop rail only — phones reach search from the top bar */}
        <button className="tab-item side-only" onClick={onSearch}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="tab-label">Search</span>
        </button>

        {/* one community per student, so this is a place you go back to rather
            than a directory you shop in */}
        {onCommunity && (
          <button className="tab-item side-only side-community" onClick={onCommunity}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="7" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="13.4" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2.6 16c.7-2.2 2.4-3.3 4.4-3.3s3.7 1.1 4.4 3.3M9 16c.7-2.2 2.4-3.3 4.4-3.3s3.7 1.1 4.4 3.3"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="tab-label">Community</span>
          </button>
        )}

        {/* Desktop only, like Search: on a phone messages live in the top bar,
            the way a feed-first app places them. Before this the rail had no
            way in at all — the top bar is display:none from 900px up. */}
        {onMessages && (
          <button className="tab-item side-only side-messages" onClick={onMessages}>
            <span className={`tab-msg-wrap ${unread ? 'has-unread' : ''}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <rect x="2.4" y="4.4" width="15.2" height="11.2" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3.2 5.8 10 10.9l6.8-5.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="tab-label">Messages{unread ? ` (${unread})` : ''}</span>
          </button>
        )}
      </div>

      <button className="tab-post" aria-label="Post" onClick={onPost}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <span className="tab-post-label">Post</span>
      </button>

      <p className="side-clock micro">{clock}</p>
    </nav>
  )
}
