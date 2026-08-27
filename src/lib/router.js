// Hash routing, deliberately.
//
// GitHub Pages serves static files, so a real path route 404s on refresh unless
// you add the 404.html redirect trick. Hash routes cost nothing here and survive
// a cold load, which is the whole point: a profile you cannot send to a group
// chat is not a profile.
//
//   #/                    map
//   #/tonight  #/feed  #/search
//   #/u/<handle>          somebody's profile
//   #/me                  your own
//   #/spot/<slug>         a spot, with its sheet open
import { useEffect, useState } from 'react'

export const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '').split('?')[0]
  const [head, ...rest] = raw.split('/').filter(Boolean)
  if (!head) return { view: 'map' }
  if (head === 'tonight' || head === 'feed' || head === 'search') return { view: head }
  if (head === 'me') return { view: 'me' }
  if (head === 'u') return { view: 'profile', handle: decodeURIComponent(rest[0] || '') }
  if (head === 'spot') return { view: 'spot', slug: decodeURIComponent(rest[0] || '') }
  return { view: 'map' }
}

export const hrefFor = (route) => {
  switch (route.view) {
    case 'map': return '#/'
    case 'tonight': return '#/tonight'
    case 'feed': return '#/feed'
    case 'search': return '#/search'
    case 'me': return '#/me'
    case 'profile': return `#/u/${encodeURIComponent(route.handle)}`
    case 'spot': return `#/spot/${encodeURIComponent(route.slug)}`
    default: return '#/'
  }
}

// Absolute, shareable — what goes in a message.
export const urlFor = (route) =>
  `${location.origin}${location.pathname}${hrefFor(route)}`

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash())
  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

// push adds history (back returns to where you were); replace does not.
export function go(route, { replace = false } = {}) {
  const href = hrefFor(route)
  if (location.hash === href) return
  // Snapshot where they were BEFORE the view changes. Recording from a scroll
  // listener loses this: by the time React has swapped the page, the element
  // has already reset to the top and the listener records that instead.
  const page = document.querySelector('.page')
  if (page) rememberScroll(location.hash || '#/', page.scrollTop)
  if (replace) history.replaceState(null, '', href)
  else location.hash = href
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

// Scroll position per route, so backing out of a profile returns you to the
// row you were looking at rather than the top of the feed.
const scrollMemory = new Map()
export const rememberScroll = (key, top) => scrollMemory.set(key, top)
export const recallScroll = (key) => scrollMemory.get(key) ?? 0
