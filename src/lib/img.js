// Size-appropriate variants of the bundled spot photography.
// Marker rings and small chrome use 96px webp thumbs (~2 KB); mid surfaces use
// the 480w variant; only heroes load the 960px original. Remote (user-uploaded)
// photo URLs pass through untouched.
import DIMS from '../data/photodims.json' with { type: 'json' }

const LOCAL = /^(.*photos\/)([^/]+)\.jpg$/

export const thumb = (src) => (src && LOCAL.test(src) ? src.replace(LOCAL, '$1thumb/$2.webp') : src)
export const mid = (src) => (src && LOCAL.test(src) ? src.replace(LOCAL, '$1$2-480.webp') : src)
export const srcSetOf = (src) => (src && LOCAL.test(src) ? `${mid(src)} 480w, ${src} 960w` : undefined)
export const dimsOf = (src) => {
  const m = src && src.match(LOCAL)
  return (m && DIMS[m[2]]) || null
}
