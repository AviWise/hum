// Publish curated Openverse picks: download the full image, size it, and record
// the licence and credit so the attribution ships with the photo.
//   node scripts/openverse-ship.mjs gravelly=1,artechouse=0,...
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const UA = 'hum/0.1 (+https://aviwise.github.io/hum/; personal student project)'
const store = JSON.parse(readFileSync('.impeccable/openverse/candidates.json', 'utf8'))
const ship = existsSync('.impeccable/openverse/ship.json') ? JSON.parse(readFileSync('.impeccable/openverse/ship.json', 'utf8')) : {}
mkdirSync('public/photos/thumb', { recursive: true })

for (const pair of process.argv[2].split(',')) {
  const [id, idxRaw] = pair.split('=')
  const c = store[id]?.[Number(idxRaw)]
  if (!c) { console.log(`${id}: no candidate ${idxRaw}`); continue }
  try {
    const r = await fetch(c.full, { headers: { 'User-Agent': UA } })
    if (!r.ok) { console.log(`${id}: http ${r.status}`); continue }
    const buf = Buffer.from(await r.arrayBuffer())
    const meta = await sharp(buf).metadata()
    if ((meta.width || 0) < 600) { console.log(`${id}: too small (${meta.width}px)`); continue }
    // same three sizes every other photo ships at
    await sharp(buf).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(`public/photos/${id}.jpg`)
    await sharp(buf).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`public/photos/${id}-480.webp`)
    await sharp(buf).resize(96, 96, { fit: 'cover' }).webp({ quality: 70 }).toFile(`public/photos/thumb/${id}.webp`)
    ship[id] = { credit: c.creator, license: c.license, source: c.source, provider: c.provider, title: c.title }
    console.log(`${id}: shipped ${meta.width}x${meta.height} — ${c.license} · ${c.creator}`)
  } catch (e) {
    console.log(`${id}: ERR ${e.message.slice(0, 60)}`)
  }
}
writeFileSync('.impeccable/openverse/ship.json', JSON.stringify(ship, null, 1))
console.log(`\n${Object.keys(ship).length} Openverse photos in the ship list`)
