import { supa } from './supa.js'

// Web push, asked for at the right moment and never on arrival.
//
// A permission prompt fired at page load is the fastest way to a permanent
// "no" — the browser remembers a denial forever. This asks only when someone
// has done something that implies they want telling, and says what they will
// get before the browser's own dialog appears.
export const PUSH_KEY = 'BHVesQkcVEx31kx39LK5t4mAC0uVA3-Ovb8DoqTA1UEHX4PQFtmwr8_1rU_6MGtUkZxZXKhXhdjrd-jU1QAWRJI'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// iOS only allows this once the app is on the home screen, and it is better to
// say so than to show a button that cannot work
export const iosNeedsInstall = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches

const urlB64 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function enablePush() {
  if (!pushSupported()) return { ok: false, why: 'unsupported' }
  if (iosNeedsInstall()) return { ok: false, why: 'ios-install' }
  if (Notification.permission === 'denied') return { ok: false, why: 'denied' }

  const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  await navigator.serviceWorker.ready
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, why: 'denied' }

  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(PUSH_KEY) })
  const j = sub.toJSON()
  const { error } = await supa.from('push_subs').upsert({
    endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
  }, { onConflict: 'endpoint' })
  if (error) return { ok: false, why: 'save-failed' }
  return { ok: true }
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (iosNeedsInstall()) return 'ios-install'
  if (Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  }
  return Notification.permission === 'denied' ? 'denied' : 'off'
}
