// Real URLs for shared spots, so a link looks like the place it points at.
//
// Hash routes cannot carry per-page previews: the fragment is never sent to a
// server, so every #/spot/... link a student pastes into a group chat gets the
// same generic card. A Cloudflare Worker could rewrite tags per request, but
// the 116 spots are static — they can simply be built.
//
// So each spot gets /s/<slug>/index.html: a real page with its own title,
// description and photo for the crawler, which bounces a human straight into
// the app. Profiles and orgs are dynamic and still need the Worker; spots are
// what people actually share.
//
// node scripts/gen-share-pages.mjs   (runs as part of npm run build)
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SITE = 'https://aviwise.github.io/out-dc'
const OUT = 'dist'

const src = readFileSync('src/data/spots.js', 'utf8')
const photos = readFileSync('src/data/photos.js', 'utf8')

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// pull id/name/area/vibe straight out of the data file rather than importing it
// (it reaches for import.meta.env, which does not exist in plain node)
const spots = [...src.matchAll(/id:\s*'([^']+)',\s*name:\s*'([^']*)',\s*area:\s*'([^']*)'[\s\S]*?vibe:\s*'((?:[^'\\]|\\.)*)'/g)]
  .map((m) => ({
    id: m[1],
    name: m[2].replace(/\\'/g, '’'),
    area: m[3].replace(/\\'/g, '’'),
    vibe: m[4].replace(/\\'/g, '’').replace(/\\"/g, '"'),
  }))

const withPhoto = new Set([...photos.matchAll(/"([a-z0-9_]+)":\s*\{\s*"src":\s*"(photos\/[^"]+)"/g)].map((m) => m[1]))
const photoFor = (id) => (withPhoto.has(id) ? `${SITE}/photos/${id}.jpg` : `${SITE}/og.png`)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const page = (spot) => {
  const slug = slugify(spot.name)
  const url = `${SITE}/s/${slug}/`
  const app = `${SITE}/#/spot/${slug}`
  const title = `${spot.name} — ${spot.area} · out.`
  const desc = spot.vibe.length > 200 ? spot.vibe.slice(0, 197) + '…' : spot.vibe
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<meta property="og:site_name" content="out." />
<meta property="og:type" content="place" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${photoFor(spot.id)}" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${photoFor(spot.id)}" />
<!-- a person gets sent on immediately; a crawler stays and reads the tags above -->
<meta http-equiv="refresh" content="0; url=${app}" />
<script>location.replace(${JSON.stringify(app)})</script>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#FBF7F0;color:#3A2E1E;display:grid;place-items:center;height:100vh}</style>
</head>
<body>
<main>
  <h1>${esc(spot.name)}</h1>
  <p>${esc(desc)}</p>
  <p><a href="${app}">Open it on the map</a></p>
</main>
</body>
</html>
`
}

let made = 0
for (const spot of spots) {
  const dir = join(OUT, 's', slugify(spot.name))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), page(spot))
  made++
}
const missing = spots.filter((s) => !withPhoto.has(s.id)).length
console.log(`share pages: ${made} spots, ${made - missing} with their own photo, ${missing} falling back to the wordmark card`)
