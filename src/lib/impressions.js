// Impressions: every time a real post is actually shown to a signed-in person,
// once per post per session. Nothing reads this yet — it exists because scoring
// is likes/impressions rather than raw likes, and equal-exposure quotas need a
// record that starts at the first post. It cannot be backfilled.
import { supa } from './supa.js'

const seen = new Set()
let queue = []
let timer = null
let viewer = null

export function setImpressionViewer(userId) {
  viewer = userId || null
}

async function flush() {
  timer = null
  const batch = queue
  queue = []
  if (!viewer || !batch.length) return
  // failures are silent on purpose: a lost impression must never cost a person
  // their post or their scroll
  await supa.from('impressions')
    .insert(batch.map((post_id) => ({ post_id, viewer_id: viewer, surface: 'city' })))
    .then(() => {}, () => {})
}

export function logImpression(postId) {
  if (!viewer || !postId || seen.has(postId)) return
  seen.add(postId)
  queue.push(postId)
  if (!timer) timer = setTimeout(flush, 1500)
}

// Attach to a rendered post element; fires once it is genuinely on screen.
export function watchImpression(el, postId) {
  if (!el || !postId || !viewer || seen.has(postId)) return () => {}
  if (typeof IntersectionObserver === 'undefined') { logImpression(postId); return () => {} }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && e.intersectionRatio > 0.5) {
        logImpression(postId)
        io.disconnect()
      }
    }
  }, { threshold: [0.5] })
  io.observe(el)
  return () => io.disconnect()
}
