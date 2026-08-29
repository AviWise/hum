// WebKit does not implement `prefers-reduced-transparency` at all — verified on
// Safari 26.5 / iOS 18.7, where NEITHER `reduce` nor `no-preference` matches,
// which per spec means the query is unknown rather than merely off. iPhone is
// hum's main platform for both the PWA and the Capacitor app, so on the devices
// that matter most the OS setting can never reach CSS. Hence an in-app override.
//
// One class drives the CSS, and JS decides its value: an explicit choice if the
// person has made one, otherwise whatever the OS says on the engines that do
// expose it. Keeping the media query in CSS as well would make an explicit OFF
// impossible to honour on those engines.
const KEY = 'hum.reduce-transparency'

const osPrefers = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches } catch { return false }
}

export function reduceTransparency() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* private mode — fall through to the OS */ }
  return osPrefers()
}

export function applyReduceTransparency(on = reduceTransparency()) {
  document.documentElement.classList.toggle('rt-reduce', on)
  return on
}

export function setReduceTransparency(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode: this session only */ }
  return applyReduceTransparency(on)
}
