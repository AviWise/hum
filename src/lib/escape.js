import { useEffect, useRef } from 'react'

// Sheets stack — a profile over a room, a post over the map — and a window
// listener per sheet would close the whole stack on one press. Handlers form a
// LIFO stack instead, so Escape only ever reaches the topmost open sheet.
//
// Refs are what get pushed, not the callbacks: onClose is almost always an
// inline arrow, so pushing the function itself would re-order the stack on
// every parent render. Pass null to stay registered but inert (a panel that is
// currently closed) — Escape then falls through to whatever is below it.
const stack = []

const onKey = (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  for (let i = stack.length - 1; i >= 0; i--) {
    const fn = stack[i].current
    if (typeof fn === 'function') { e.preventDefault(); fn(); return }
  }
}

export function useEscape(onClose) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (stack.length === 0) window.addEventListener('keydown', onKey)
    stack.push(ref)
    return () => {
      const i = stack.lastIndexOf(ref)
      if (i !== -1) stack.splice(i, 1)
      if (stack.length === 0) window.removeEventListener('keydown', onKey)
    }
  }, [])
}
