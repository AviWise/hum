// Post photos, prepared on the device and stored at three sizes so no surface
// ever downloads more than it draws: 96px for map markers, 480px for feed
// cards, 1280px for the sheet.
//
// EXIF (including GPS) is removed by construction: every variant is re-encoded
// through a canvas, which copies pixels only — the original file's metadata
// blocks are never in the bytes we upload. That is stronger than a stripping
// pass that has to enumerate what to remove, and it needs no server round trip.
import { supa } from './supa.js'

const SIZES = [
  { key: 'photo', px: 1280, quality: 0.82, fit: 'contain' },
  { key: 'mid', px: 480, quality: 0.78, fit: 'contain' },
  { key: 'thumb', px: 96, quality: 0.72, fit: 'cover' },
]

async function encode(bitmap, { px, quality, fit }) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (fit === 'cover') {
    canvas.width = canvas.height = px
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, px, px)
  } else {
    const scale = Math.min(1, px / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  const type = 'image/webp'
  const blob = await new Promise((res) => canvas.toBlob(res, type, quality))
  return blob || new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
}

// Returns { photo_path, mid_path, thumb_path } — public URLs in our own bucket.
export async function uploadPostPhoto(file, userId) {
  const bitmap = await createImageBitmap(file)
  const stem = `${userId}/${crypto.randomUUID()}`
  const out = {}
  for (const size of SIZES) {
    const blob = await encode(bitmap, size)
    const path = `${stem}-${size.key}.webp`
    const { error } = await supa.storage.from('post-photos').upload(path, blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: '31536000',
    })
    if (error) throw new Error(error.message)
    out[`${size.key}_path`] = supa.storage.from('post-photos').getPublicUrl(path).data.publicUrl
  }
  bitmap.close?.()
  return out
}
