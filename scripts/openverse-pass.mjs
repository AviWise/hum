// Openverse: find openly-licensed photography for the spots that still run on
// drawn art. Openverse aggregates Flickr, Wikimedia, museums and more, and — the
// reason we can use it at all — it returns the licence with every result.
//
// Nothing here publishes. It downloads candidates and writes a contact sheet,
// because the last pass taught the same lesson every time: a search for a D.C.
// venue will happily return the wrong city, the wrong century, or a stock photo
// of a cocktail. A person has to look.
//
//   node scripts/openverse-pass.mjs            # every spot without a photo
//   node scripts/openverse-pass.mjs bliss,comet
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const API = 'https://api.openverse.org/v1/images/'
const UA = 'hum/0.1 (+https://aviwise.github.io/hum/; personal student project)'
const DIR = '.impeccable/openverse'
mkdirSync(DIR, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// licences we may actually ship: reuse allowed, modification allowed.
// Explicitly NOT nc (non-commercial) or nd (no derivatives) — we crop and resize.
const OK_LICENCE = new Set(['cc0', 'pdm', 'by', 'by-sa'])
// words too common to prove anything on their own
const STOP = new Set(['club', 'bar', 'cafe', 'house', 'street', 'park', 'point', 'hall', 'room', 'the', 'and', 'dc', 'washington', 'lounge', 'garden', 'center', 'centre', 'museum', 'gallery', 'theatre', 'theater'])

const spotsSrc = readFileSync('src/data/spots.js', 'utf8')
const photosSrc = readFileSync('src/data/photos.js', 'utf8')
const have = new Set([...photosSrc.matchAll(/"([a-z0-9_]+)":\s*\{\s*"src":\s*"photos\//g)].map((m) => m[1]))
const SPOTS = [...spotsSrc.matchAll(/id: '([a-z0-9_]+)', name: '([^']+)', area: '([^']+)'[\s\S]{0,140}?coords: \[(-[\d.]+), ([\d.]+)\]/g)]
  .map((m) => ({ id: m[1], name: m[2], area: m[3], lng: +m[4], lat: +m[5] }))

const wanted = process.argv[2]
  ? process.argv[2].split(',').map((id) => SPOTS.find((s) => s.id === id)).filter(Boolean)
  : SPOTS.filter((s) => !have.has(s.id))

const store = existsSync(`${DIR}/candidates.json`) ? JSON.parse(readFileSync(`${DIR}/candidates.json`, 'utf8')) : {}

const isImage = (b) => (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) ||
  (b[0] === 0x52 && b[1] === 0x49) /* webp */ || (b[0] === 0x47 && b[1] === 0x49) /* gif */

// A search for "Flash" returns camera flashes; a search for the venue plus its
// street returns the venue. Bias every query toward the actual place.
const queryFor = (s) => {
  const bare = s.name.replace(/[’']/g, '').replace(/&/g, 'and')
  return [`${bare} Washington DC`, `${bare} ${s.area.split(/[,/]/)[0]} DC`]
}

console.log(`${wanted.length} spot(s) to search\n`)
for (const spot of wanted) {
  if (store[spot.id]?.length >= 3) { console.log(`${spot.id.padEnd(14)} cached (${store[spot.id].length})`); continue }
  const found = []
  for (const q of queryFor(spot)) {
    if (found.length >= 4) break
    await sleep(900)
    try {
      const url = `${API}?q=${encodeURIComponent(q)}&license=${[...OK_LICENCE].join(',')}&page_size=8&mature=false`
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!r.ok) { console.log(`${spot.id.padEnd(14)} http ${r.status}`); continue }
      const d = await r.json()
      for (const it of d.results || []) {
        if (found.length >= 4) break
        if (!OK_LICENCE.has(it.license)) continue
        if (found.some((f) => f.id === it.id)) continue
        if ((it.width || 0) < 600 || (it.height || 0) < 400) continue
        if (/\b(map|logo|seal|diagram|poster|flyer|screenshot|clipart)\b/i.test(it.title || '')) continue
        // The title has to corroborate the venue. Searching "Bliss" returned a
        // Dumbarton Oaks plaque honouring Robert Woods Bliss; searching "Comet"
        // returned band photos that never name the room. A keyword hit is not
        // evidence that the photograph is of the place.
        const hay = `${it.title || ''} ${it.tags?.map((t) => t.name).join(' ') || ''}`.toLowerCase()
        const tokens = spot.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w))
        const corroborated = tokens.length > 0 && tokens.every((t) => hay.includes(t))
        found.push({
          corroborated,
          id: it.id,
          title: (it.title || '').slice(0, 90),
          creator: (it.creator || 'Unknown').slice(0, 60),
          license: `${it.license.toUpperCase()}${it.license_version ? ' ' + it.license_version : ''}`,
          licenseUrl: it.license_url,
          source: it.foreign_landing_url,
          provider: it.provider,
          thumb: it.thumbnail || it.url,
          full: it.url,
          query: q,
        })
      }
    } catch (e) {
      console.log(`${spot.id.padEnd(14)} ERR ${e.message.slice(0, 40)}`)
    }
  }
  // pull the thumbnails so they can be eyeballed
  let saved = 0
  for (let i = 0; i < found.length; i++) {
    await sleep(500)
    try {
      const r = await fetch(found[i].thumb, { headers: { 'User-Agent': UA } })
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      if (!isImage(buf)) continue
      writeFileSync(`${DIR}/${spot.id}-${i}.jpg`, buf)
      saved++
    } catch { /* skip */ }
  }
  store[spot.id] = found
  writeFileSync(`${DIR}/candidates.json`, JSON.stringify(store, null, 1))
  const solid = found.filter((f) => f.corroborated).length
  console.log(`${spot.id.padEnd(14)} ${found.length} found, ${solid} title-corroborated${solid ? '  <-- worth a look' : ''}`)
}

// contact sheet — the curation step, not optional
let html = `<style>body{font-family:system-ui;background:#f7f3ec;color:#21201c;margin:18px}
h3{margin:18px 0 6px;font-size:14px}.row{display:flex;gap:8px;flex-wrap:wrap}
.c{width:190px}.c img{width:190px;height:130px;object-fit:cover;border-radius:8px;background:#e6ddcc}
small{display:block;font-size:9px;line-height:1.3;margin-top:3px;color:#6e6355}</style>
<h2>Openverse candidates — eyeball before shipping</h2>`
for (const [id, arr] of Object.entries(store)) {
  const s = SPOTS.find((x) => x.id === id)
  html += `<h3>${id} — ${s ? s.name + ' · ' + s.area : ''}</h3><div class="row">`
  arr.forEach((a, i) => {
    html += `<div class="c"><img src="${id}-${i}.jpg" onerror="this.style.opacity=.15">
      <small>[${i}] ${a.corroborated ? '<b>title matches</b> · ' : ''}${a.license} · ${a.provider}<br>${a.creator}<br>${a.title}</small></div>`
  })
  html += '</div>'
}
writeFileSync(`${DIR}/sheet.html`, html)
console.log(`\ncontact sheet: ${DIR}/sheet.html`)
