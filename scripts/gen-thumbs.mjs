// Generate marker thumbnails (96×96 webp) and mid-size 480w variants for every
// photo in public/photos/, plus an intrinsic-dimensions map for layout stability.
// Re-run after gen-photos.mjs adds new photos.  node scripts/gen-thumbs.mjs
import sharp from 'sharp'
import { readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs'

const SRC = 'public/photos'
const THUMB = 'public/photos/thumb'
mkdirSync(THUMB, { recursive: true })

const dims = {}
let tBytes = 0
let mBytes = 0
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.jpg'))) {
  const name = f.replace(/\.jpg$/, '')
  const img = sharp(`${SRC}/${f}`)
  const meta = await img.metadata()
  dims[name] = [meta.width, meta.height]
  await sharp(`${SRC}/${f}`).resize(96, 96, { fit: 'cover' }).webp({ quality: 70 }).toFile(`${THUMB}/${name}.webp`)
  await sharp(`${SRC}/${f}`).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toFile(`${SRC}/${name}-480.webp`)
  tBytes += statSync(`${THUMB}/${name}.webp`).size
  mBytes += statSync(`${SRC}/${name}-480.webp`).size
}
writeFileSync('src/data/photodims.json', JSON.stringify(dims))
console.log(`thumbs: ${Object.keys(dims).length} files, ${(tBytes / 1024).toFixed(0)} KB total (avg ${(tBytes / 1024 / Object.keys(dims).length).toFixed(1)} KB)`)
console.log(`480w: ${(mBytes / 1024 / 1024).toFixed(1)} MB total`)
