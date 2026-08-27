// The warm world, in one place. Both the city map and the small haunts map on
// a profile draw from this, so they cannot drift apart.
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
// Initial desktop frame: the readable core. Outliers (The Den, Kenilworth,
// the Arboretum, Kingman) live just off-view and reward panning.
export const CITY_BOUNDS = [
  [-77.078, 38.862],
  [-76.984, 38.94],
]
// Phones open on the busiest core and pan outward; fitting the whole city at
// 390px clamps to min-zoom and buries the labels in each other.
export const CORE_BOUNDS = [
  [-77.055, 38.884],
  [-77.004, 38.933],
]

// Recolor the base style into the app's warm world: bone ground, warm-white
// streets, sage parks, pale water, ink-soft labels. Geometry stays the tile
// provider's; only paint changes.
export function warmify(style) {
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
      else if (/boundary|admin/.test(id)) {
        // the D.C. diamond stays, but as a whisper — visible when you look
        // for it, silent when you don't
        set(layer, 'line-color', '#dcd2ba')
        set(layer, 'line-opacity', 0.4)
      }
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

