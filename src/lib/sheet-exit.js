import { useCallback, useEffect, useRef, useState } from 'react'

// Sheets are conditionally rendered, so closing one unmounts it and the pixels
// simply vanish — every sheet in the app rose in over 450ms and then left in 0.
// CSS alone cannot fix that (@starting-style needs the node to stay in the DOM),
// so the close is held just long enough for the exit to play, then the real
// onClose runs and React unmounts as before.
//
// 260ms against the 450ms entrance, on purpose: an opening sheet is an
// invitation, a closing one should get out of the way.
const EXIT_MS = 260

export function useSheetExit(onClose) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  const cb = useRef(onClose)
  cb.current = onClose

  useEffect(() => () => clearTimeout(timer.current), [])

  const close = useCallback(() => {
    if (timer.current) return // already leaving — a second press must not requeue
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { cb.current?.(); return }
    setClosing(true)
    timer.current = setTimeout(() => cb.current?.(), EXIT_MS)
  }, [])

  return { closing, onClose: close }
}
