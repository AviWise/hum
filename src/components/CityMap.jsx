import { useEffect, useRef } from 'react'
import { Map as GlMap, Marker, Popup, AttributionControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Bundlers keep dropping maplibre's worker chunk (rolldown-vite emits nothing,
// its dev optimizer 404s it), so the worker ships as a plain static asset —
// public/maplibre-gl-worker.mjs + its maplibre-gl-shared.mjs sibling, synced by
// the postinstall script. Keep the three versions in lockstep.
setWorkerUrl(import.meta.env.BASE_URL + 'maplibre-gl-worker.mjs')
import { SPOTS, CATEGORIES, liveBusy } from '../data/spots.js'
import { artUrl } from './markerArt.js'
import { spotPhoto } from '../data/photos.js'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
// Initial desktop frame: the readable core. Outliers (The Den, Kenilworth,
// the Arboretum, Kingman) live just off-view and reward panning.
const CITY_BOUNDS = [
  [-77.078, 38.862],
  [-76.984, 38.94],
]
// Phones open on the busiest core and pan outward; fitting the whole city at
// 390px clamps to min-zoom and buries the labels in each other.
const CORE_BOUNDS = [
  [-77.055, 38.884],
  [-77.004, 38.933],
]

// Recolor the base style into the app's warm world: bone ground, warm-white
// streets, sage parks, pale water, ink-soft labels. Geometry stays the tile
// provider's; only paint changes.
function warmify(style) {
  const set = (layer, prop, val) => {
    layer.paint = { ...(layer.paint || {}), [prop]: val }
  }
  for (const layer of style.layers || []) {
    const id = layer.id
    if (layer.type === 'background') {
      set(layer, 'background-color', '#f5f1e6')
    } else if (layer.type === 'fill') {
      if (/water|ocean/.test(id)) set(layer, 'fill-color', '#ccdad3')
      else if (/park|grass|wood|forest|cemetery|golf|garden|zoo|pitch|stadium/.test(id)) set(layer, 'fill-color', '#e2e7d2')
      else if (/building/.test(id)) {
        set(layer, 'fill-color', '#ebe3cf')
        set(layer, 'fill-outline-color', '#ddd1b6')
      } else if (/sand|beach|aeroway/.test(id)) set(layer, 'fill-color', '#efe7d3')
      else if (/hospital|school|college|university/.test(id)) set(layer, 'fill-color', '#f1ebdc')
      else if (/residential|suburb|neighbourhood|landuse|landcover/.test(id)) set(layer, 'fill-color', '#f2ede0')
      else set(layer, 'fill-color', '#f1ecdd')
    } else if (layer.type === 'line') {
      if (/water|river|stream|canal/.test(id)) set(layer, 'line-color', '#ccdad3')
      else if (/casing/.test(id)) set(layer, 'line-color', '#e2d8bf')
      else if (/motorway|trunk/.test(id)) set(layer, 'line-color', '#f2e2c2')
      else if (/rail|transit/.test(id)) set(layer, 'line-color', '#ded3ba')
      else if (/boundary|admin/.test(id)) set(layer, 'line-color', '#d2c5a9')
      else if (/bridge|tunnel|highway|road|street|path|minor|service|pedestrian|track/.test(id)) set(layer, 'line-color', '#fdfbf4')
      else set(layer, 'line-color', '#e6dcc5')
    } else if (layer.type === 'symbol') {
      set(layer, 'text-color', /water|marine|ferry/.test(id) ? '#88a094' : '#77694f')
      set(layer, 'text-halo-color', 'rgba(247, 243, 236, 0.92)')
      set(layer, 'text-halo-width', 1.2)
    }
  }
  return style
}

// Heat features: real crowd curves at the viewed time, live post density,
// and active-event boosts — normalized to the busiest spot so relative
// busyness stays legible even on a quiet Tuesday.
function heatData(effNow, eventCounts, boosts) {
  const lives = SPOTS.map((sp) => {
    const base = liveBusy(sp, effNow)
    const posts = Math.min(18, (eventCounts?.[sp.id] || 0) * 6)
    const boost = boosts?.[sp.id] || 0
    return Math.min(100, base + posts + boost)
  })
  const maxLive = Math.max(...lives, 1)
  return {
    type: 'FeatureCollection',
    features: SPOTS.map((sp, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: sp.coords },
      properties: { busy: Math.round((lives[i] / maxLive) * 60 + (lives[i] / 100) * 40), cat: sp.cat },
    })),
  }
}

function paddingFor(width) {
  return width >= 900
    ? { top: 110, bottom: 60, left: 316, right: 372 }
    : { top: 96, bottom: 300, left: 34, right: 34 }
}

function buildMarker(spot, cat, onPick) {
  const el = document.createElement('button')
  el.type = 'button'
  const live = liveBusy(spot)
  el.className = `gmark ${spot.labelUp ? 'gmark-up' : ''} ${spot.minor ? 'gmark-minor' : ''} ${!spot.minor && live < 70 ? 'gmark-mid' : ''}`
  el.style.setProperty('--c', cat.color)
  const size = spot.minor ? 29 : 31 + Math.round(live / 7) // 29–45px bubble
  el.style.setProperty('--dot', `${size}px`)
  const dot = document.createElement('span')
  dot.className = 'gmark-dot'
  dot.setAttribute('aria-hidden', 'true')
  const src = spotPhoto(spot.id)?.src || artUrl(spot.art)
  if (src) {
    const img = document.createElement('img')
    img.className = 'gmark-art'
    img.src = src
    img.alt = ''
    img.loading = 'lazy'
    img.draggable = false
    dot.appendChild(img)
  }
  const count = document.createElement('span')
  count.className = 'gmark-count'
  count.hidden = true
  const label = document.createElement('span')
  label.className = 'gmark-label'
  label.setAttribute('aria-hidden', 'true')
  label.textContent = spot.name.toUpperCase()
  el.append(dot, count, label)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    onPick(spot.id)
  })
  return el
}

export default function CityMap({ activeCats, selected, onSelect, eventCounts, metroOn, effNow, boosts, onTrain }) {
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const loadedRef = useRef(false)
  const heatTimerRef = useRef(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const metroRef = useRef(metroOn)
  metroRef.current = metroOn
  const effNowRef = useRef(effNow)
  effNowRef.current = effNow
  const eventCountsRef = useRef(eventCounts)
  eventCountsRef.current = eventCounts
  const boostsRef = useRef(boosts)
  boostsRef.current = boosts
  const onTrainRef = useRef(onTrain)
  onTrainRef.current = onTrain

  useEffect(() => {
    let cancelled = false
    let map
    ;(async () => {
      let style = STYLE_URL
      try {
        const res = await fetch(STYLE_URL)
        style = warmify(await res.json())
      } catch {
        /* fall back to the provider's own colors rather than no map */
      }
      if (cancelled) return

      map = new GlMap({
        container: wrapRef.current,
        style,
        bounds: window.innerWidth >= 900 ? CITY_BOUNDS : CORE_BOUNDS,
        fitBoundsOptions: { padding: paddingFor(window.innerWidth) },
        minZoom: 10.5,
        maxZoom: 17.5,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      })
      map.touchZoomRotate.disableRotation()
      map.addControl(new AttributionControl({ compact: true }), 'top-right')
      mapRef.current = map
      window.__map = map

      // label tiers: minors speak above z12.4; mid-weight spots above z12.0
      const syncZoomClass = () => {
        const z = map.getZoom()
        wrapRef.current?.classList.toggle('map-zfar', z < 12.4)
        wrapRef.current?.classList.toggle('map-zfar2', z < 12.0)
      }
      map.on('zoom', syncZoomClass)
      syncZoomClass()

      map.on('load', () => {
        map.addSource('busy', { type: 'geojson', data: heatData(effNowRef.current, eventCountsRef.current, boostsRef.current) })
        const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
        // wide warm halo
        map.addLayer(
          {
            id: 'busy-heat',
            type: 'heatmap',
            source: 'busy',
            paint: {
              'heatmap-weight': ['/', ['get', 'busy'], 100],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.0, 15, 2.6],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 32, 13, 90, 16, 170],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 14, 0.6, 16, 0.5],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(217, 122, 80, 0)',
                0.25, 'rgba(232, 195, 166, 0.34)',
                0.55, 'rgba(222, 155, 114, 0.55)',
                0.8, 'rgba(206, 108, 62, 0.68)',
                1, 'rgba(178, 74, 38, 0.78)',
              ],
            },
          },
          firstSymbol,
        )
        // tight saturated core that survives zoom — the part that reads as
        // THE busy block instead of washing into the bone streets
        map.addLayer(
          {
            id: 'busy-heat-core',
            type: 'heatmap',
            source: 'busy',
            paint: {
              'heatmap-weight': ['/', ['get', 'busy'], 100],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 13, 2.4, 16, 3.6],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 13, 48, 16, 100],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 0.65, 16, 0.85],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(200, 90, 48, 0)',
                0.4, 'rgba(198, 92, 46, 0.4)',
                0.75, 'rgba(180, 62, 30, 0.7)',
                1, 'rgba(150, 40, 20, 0.88)',
              ],
            },
          },
          firstSymbol,
        )
        // WMATA lines (DC Open Data), toggleable — semantic transit colors,
        // muted so they sit inside the warm world rather than on top of it
        map.addSource('metro', { type: 'geojson', data: import.meta.env.BASE_URL + 'metro-lines.geojson' })
        map.addLayer(
          {
            id: 'metro-lines',
            type: 'line',
            source: 'metro',
            layout: { 'line-cap': 'round', 'line-join': 'round', visibility: metroRef.current ? 'visible' : 'none' },
            paint: {
              'line-color': ['match', ['get', 'line'],
                'red', '#B34A56', 'orange', '#D28A3C', 'yellow', '#CFAC46',
                'green', '#4E9163', 'blue', '#4E7FA3', 'silver', '#989184', '#989184'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 3.6],
              'line-opacity': 0.55,
            },
          },
          firstSymbol,
        )
        map.addSource('metro-stops', { type: 'geojson', data: import.meta.env.BASE_URL + 'metro-stations.geojson' })
        map.addLayer(
          {
            id: 'metro-stops',
            type: 'circle',
            source: 'metro-stops',
            minzoom: 11,
            layout: { visibility: metroRef.current ? 'visible' : 'none' },
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.6, 14, 5],
              'circle-color': '#FDFBF6',
              'circle-stroke-color': '#5C5248',
              'circle-stroke-width': 1.8,
            },
          },
          firstSymbol,
        )
        map.addLayer({
          id: 'metro-stop-labels',
          type: 'symbol',
          source: 'metro-stops',
          minzoom: 12.6,
          layout: {
            visibility: metroRef.current ? 'visible' : 'none',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#5C5248',
            'text-halo-color': 'rgba(247, 243, 236, 0.95)',
            'text-halo-width': 1.4,
          },
        })
        // Every OSM place, Google-Maps style: tiny dots past neighborhood zoom,
        // labels a step later. Curated spots stay the photo bubbles above.
        const POI_COLOR = ['match', ['get', 'class'],
          'bar', '#8E4141', 'pub', '#8E4141', 'beer', '#8E4141', 'nightclub', '#5C2B52',
          'restaurant', '#C05B33', 'fast_food', '#C05B33', 'bakery', '#C05B33', 'ice_cream', '#C05B33',
          'cafe', '#B08430',
          'theatre', '#6B4A32', 'cinema', '#6B4A32', 'museum', '#6B4A32', 'library', '#6B4A32',
          'art_gallery', '#6B4A32', 'attraction', '#7E6A4F',
          '#7E6A4F']
        const POI_CLASS = ['in', ['get', 'class'], ['literal',
          ['bar', 'pub', 'beer', 'nightclub', 'restaurant', 'fast_food', 'cafe', 'bakery', 'ice_cream',
           'theatre', 'cinema', 'museum', 'library', 'art_gallery', 'attraction']]]
        // gradual reveal, Google-style: prominent places first, the long tail
        // as you keep zooming (openmaptiles rank = prominence within its grid)
        const RANK = ['coalesce', ['get', 'rank'], 999]
        const POI_FILTER = ['all', POI_CLASS, ['<=', RANK, ['step', ['zoom'], 12, 14, 25, 15, 999]]]
        const POI_LABEL_FILTER = ['all', POI_CLASS, ['<=', RANK, ['step', ['zoom'], 12, 15, 25, 16, 999]]]
        map.addLayer({
          id: 'osm-poi',
          type: 'circle',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 14.0,
          filter: POI_FILTER,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.2, 16.5, 4.4],
            'circle-color': POI_COLOR,
            'circle-stroke-color': '#FDFBF6',
            'circle-stroke-width': 1.2,
            'circle-opacity': 0.9,
          },
        }, firstSymbol)
        map.addLayer({
          id: 'osm-poi-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 14.0,
          filter: POI_LABEL_FILTER,
          layout: {
            'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': 9.5,
            'text-offset': [0, 0.8],
            'text-anchor': 'top',
            'text-max-width': 8,
          },
          paint: {
            'text-color': POI_COLOR,
            'text-halo-color': 'rgba(247, 243, 236, 0.95)',
            'text-halo-width': 1.3,
          },
        })

        // tap targets: OSM places and Metro stations get warm popups
        const pop = new Popup({ closeButton: false, offset: 12, className: 'out-pop', maxWidth: '260px' })
        const showPoi = (e) => {
          const f = e.features?.[0]
          if (!f) return
          const el = document.createElement('div')
          const name = document.createElement('p')
          name.className = 'pop-name'
          name.textContent = f.properties['name:en'] || f.properties.name || 'Unnamed'
          const kind = document.createElement('p')
          kind.className = 'pop-kind'
          kind.textContent = (f.properties.class || '').replace(/_/g, ' ')
          el.append(name, kind)
          pop.setLngLat(e.lngLat).setDOMContent(el).addTo(map)
        }
        const LINE_COLORS = { red: '#B34A56', orange: '#D28A3C', yellow: '#CFAC46', green: '#4E9163', blue: '#4E7FA3', silver: '#989184' }
        const showStation = (e) => {
          const f = e.features?.[0]
          if (!f) return
          const el = document.createElement('div')
          const name = document.createElement('p')
          name.className = 'pop-name'
          name.textContent = f.properties.name
          const chips = document.createElement('p')
          chips.className = 'pop-lines'
          for (const ln of (f.properties.lines || '').split(',').map((x) => x.trim()).filter(Boolean)) {
            const dot = document.createElement('span')
            dot.className = 'pop-line-dot'
            dot.style.background = LINE_COLORS[ln] || '#989184'
            dot.title = ln
            chips.appendChild(dot)
            const t = document.createElement('span')
            t.className = 'pop-line-name'
            t.textContent = ln
            chips.appendChild(t)
          }
          const arr = document.createElement('div')
          arr.className = 'pop-trains'
          arr.textContent = f.properties.code ? 'next trains…' : ''
          el.append(name, chips, arr)
          pop.setLngLat(e.lngLat).setDOMContent(el).addTo(map)
          if (!f.properties.code) return
          const TRAIN_LINE = { RD: '#B34A56', OR: '#D28A3C', YL: '#CFAC46', GR: '#4E9163', BL: '#4E7FA3', SV: '#989184' }
          fetch('https://hxmjszgvkynrwscelnzx.supabase.co/functions/v1/train-times', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX',
            },
            body: JSON.stringify({ codes: f.properties.code }),
          })
            .then((r) => r.json())
            .then((d) => {
              arr.textContent = ''
              if (!d.trains || !d.trains.length) {
                arr.textContent = 'no trains right now'
                arr.className = 'pop-kind pop-trains'
                return
              }
              for (const t of d.trains.slice(0, 5)) {
                const row = document.createElement('button')
                row.type = 'button'
                row.className = 'pop-train-row'
                row.addEventListener('click', () => {
                  pop.remove()
                  onTrainRef.current?.({ code: f.properties.code, line: t.line, dest: t.dest, min: t.min, station: f.properties.name })
                })
                const dot = document.createElement('span')
                dot.className = 'pop-line-dot'
                dot.style.background = TRAIN_LINE[t.line] || '#989184'
                const dest = document.createElement('span')
                dest.className = 'pop-train-dest'
                dest.textContent = t.dest === 'LastTrain' ? 'Last train' : t.dest
                const min = document.createElement('span')
                min.className = 'pop-train-min'
                min.textContent = t.min === 'BRD' ? 'boarding' : t.min === 'ARR' ? 'arriving' : `${t.min} min`
                row.append(dot, dest, min)
                arr.appendChild(row)
              }
            })
            .catch(() => { arr.textContent = '' })
        }
        for (const layer of ['osm-poi', 'osm-poi-label']) {
          map.on('click', layer, showPoi)
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
        }
        for (const layer of ['metro-stops', 'metro-stop-labels']) {
          map.on('click', layer, showStation)
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
        }
        loadedRef.current = true
        map.setFilter('busy-heat', ['in', ['get', 'cat'], ['literal', [...activeCats]]])
        map.setFilter('busy-heat-core', ['in', ['get', 'cat'], ['literal', [...activeCats]]])

        // signature: the heat is a living field — a slow six-second breath,
        // skipped for reduced-motion users
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const t0 = performance.now()
          heatTimerRef.current = setInterval(() => {
            if (!map.getLayer('busy-heat')) return
            const phase = ((performance.now() - t0) / 6000) * Math.PI
            const breathe = 1 + 0.16 * Math.sin(phase)
            map.setPaintProperty('busy-heat', 'heatmap-intensity',
              ['interpolate', ['linear'], ['zoom'], 10, 1.0 * breathe, 15, 2.6 * breathe])
          }, 120)
        }
      })

      for (const spot of SPOTS) {
        const cat = CATEGORIES[spot.cat]
        const el = buildMarker(spot, cat, (id) => onSelect(id === selectedRef.current ? null : id))
        el.setAttribute('aria-label', `${spot.name}, ${cat.label}`)
        markersRef.current[spot.id] = el
        new Marker({ element: el, anchor: 'center' }).setLngLat(spot.coords).addTo(map)
      }
    })()
    return () => {
      cancelled = true
      clearInterval(heatTimerRef.current)
      map?.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // category filter -> marker visibility + heat filter
  useEffect(() => {
    for (const spot of SPOTS) {
      markersRef.current[spot.id]?.classList.toggle('pin-off', !activeCats.has(spot.cat))
    }
    const map = mapRef.current
    if (map && loadedRef.current) {
      map.setFilter('busy-heat', ['in', ['get', 'cat'], ['literal', [...activeCats]]])
      map.setFilter('busy-heat-core', ['in', ['get', 'cat'], ['literal', [...activeCats]]])
    }
  }, [activeCats])

  // live heat: refresh when the viewed time, posts, or boosts change
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      map.getSource('busy')?.setData(heatData(effNow, eventCounts, boosts))
    }
  }, [effNow, eventCounts, boosts])


  // metro overlay visibility
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      for (const layer of ['metro-lines', 'metro-stops', 'metro-stop-labels']) {
        if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', metroOn ? 'visible' : 'none')
      }
    }
  }, [metroOn])
  // selection highlight
  useEffect(() => {
    for (const spot of SPOTS) {
      markersRef.current[spot.id]?.classList.toggle('gmark-sel', spot.id === selected)
    }
  }, [selected])

  // live post-count badges
  useEffect(() => {
    for (const spot of SPOTS) {
      const el = markersRef.current[spot.id]?.querySelector('.gmark-count')
      if (!el) continue
      const n = eventCounts[spot.id] || 0
      el.hidden = n === 0
      el.textContent = n > 9 ? '9+' : String(n)
    }
  }, [eventCounts])

  return (
    <div className="map-wrap">
      <div ref={wrapRef} className="map-gl" />
      <div className="zoomer" role="group" aria-label="Map zoom">
        <button className="zoom-btn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <button className="zoom-btn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
}
