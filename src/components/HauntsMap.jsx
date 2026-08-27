import { useEffect, useRef } from 'react'
import { Map as GlMap, Marker } from 'maplibre-gl'
import { SPOTS, CATEGORIES } from '../data/spots.js'
import { warmify, STYLE_URL } from '../lib/mapstyle.js'

const bySpot = Object.fromEntries(SPOTS.map((s) => [s.id, s]))

// Somebody's trail, drawn. A list of place names tells you nothing about a
// city; the shape of where a person actually goes tells you everything. Same
// warm palette as the real map, no controls, not interactive — it is a
// portrait, not a tool.
export default function HauntsMap({ spotIds = [] }) {
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const ids = [...new Set(spotIds)].filter((id) => bySpot[id])

  useEffect(() => {
    if (!wrapRef.current || !ids.length || mapRef.current) return
    const lngs = ids.map((id) => bySpot[id].coords[0])
    const lats = ids.map((id) => bySpot[id].coords[1])
    const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]

    const map = new GlMap({
      container: wrapRef.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 34, maxZoom: 13.4 },
      attributionControl: false,
      interactive: false,
    })
    mapRef.current = map
    map.once('styledata', () => {
      try { map.setStyle(warmify(map.getStyle()), { diff: true }) } catch { /* provider colours beat no map */ }
    })
    map.once('load', () => {
      wrapRef.current?.classList.add('haunts-ready')
      for (const id of ids) {
        const spot = bySpot[id]
        const el = document.createElement('span')
        el.className = 'haunt-pin'
        el.style.setProperty('--c', CATEGORIES[spot.cat].color)
        new Marker({ element: el, anchor: 'center' }).setLngLat(spot.coords).addTo(map)
      }
    })
    return () => { map.remove(); mapRef.current = null }
  }, [ids.join(',')])

  if (!ids.length) return null
  return (
    <div className="haunts">
      <div ref={wrapRef} className="haunts-map" aria-hidden="true" />
      <p className="micro haunts-list">{ids.slice(0, 6).map((id) => bySpot[id].name).join(' · ')}</p>
    </div>
  )
}
