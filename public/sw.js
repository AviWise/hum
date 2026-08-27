// Service worker: exists to receive pushes and open the right place when one
// is tapped. Deliberately no offline caching — a live map that serves a stale
// answer is worse than a map that says it cannot reach the network.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { /* keep the fallback */ }
  const title = d.title || 'out.'
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/out-dc/icon-192.png',
    badge: '/out-dc/icon-192.png',
    tag: d.tag || 'out',
    data: { url: d.url || '/out-dc/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/out-dc/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // reuse a tab that is already open rather than piling up windows
    for (const c of all) {
      if (c.url.includes('/out-dc/')) { await c.focus(); return c.navigate(url) }
    }
    return self.clients.openWindow(url)
  })())
})
