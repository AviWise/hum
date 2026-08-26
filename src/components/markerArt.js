// Tiny drawn scenes for map bubbles — one ink (#6E6151), warm grounds, one
// wash per scene, designed for a circular crop at 28–48px. Drawn, not
// photographed, per the design system; real photos arrive as user posts.

const I = '#6E6151'
const scene = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>${body}</svg>`

export const MARKER_ART = {
  rowhouse: scene('#F2E3D9', `
    <rect x="7" y="27" width="23" height="30" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <rect x="34" y="21" width="23" height="36" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <rect x="7" y="27" width="23" height="6" fill="#5C2B52" opacity=".35" stroke="${I}" stroke-width="2"/>
    <rect x="34" y="21" width="23" height="6" fill="#C05B33" opacity=".35" stroke="${I}" stroke-width="2"/>
    <rect x="12" y="39" width="6" height="7" fill="#5C2B52" opacity=".3" stroke="${I}" stroke-width="1.8"/>
    <rect x="21" y="39" width="6" height="7" fill="none" stroke="${I}" stroke-width="1.8"/>
    <rect x="39" y="33" width="6" height="7" fill="none" stroke="${I}" stroke-width="1.8"/>
    <rect x="48" y="33" width="6" height="7" fill="#C05B33" opacity=".3" stroke="${I}" stroke-width="1.8"/>
    <path d="M4 57h56" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`),

  stage: scene('#EFE0D6', `
    <path d="M10 44 A22 22 0 0 1 54 44" fill="#F7EFEA" stroke="${I}" stroke-width="2.5"/>
    <path d="M22 24 L30 42 M42 24 L34 42" stroke="#C05B33" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>
    <circle cx="30" cy="43" r="4" fill="#C05B33" opacity=".35"/>
    <circle cx="34" cy="43" r="4" fill="#C05B33" opacity=".35"/>
    <rect x="12" y="46" width="40" height="7" fill="#EADFCB" stroke="${I}" stroke-width="2.5"/>
    <path d="M16 58 q3 -5 6 0 M27 58 q3 -5 6 0 M38 58 q3 -5 6 0" fill="none" stroke="${I}" stroke-width="2" stroke-linecap="round"/>`),

  beergarden: scene('#EDE8D5', `
    <path d="M6 16 Q32 28 58 16" fill="none" stroke="${I}" stroke-width="2"/>
    <circle cx="16" cy="20" r="2.4" fill="#B08430"/><circle cx="28" cy="23" r="2.4" fill="#B08430"/>
    <circle cx="40" cy="23" r="2.4" fill="#B08430"/><circle cx="52" cy="18" r="2.4" fill="#B08430"/>
    <rect x="22" y="32" width="15" height="21" rx="2" fill="#EFC868" opacity=".55" stroke="${I}" stroke-width="2.5"/>
    <path d="M37 37 h6 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-6" fill="none" stroke="${I}" stroke-width="2.5"/>
    <path d="M21 32 q8 -6 17 0" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <path d="M10 57h44" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`),

  divebar: scene('#E9DFD2', `
    <path d="M18 18 h28 l-14 16 z" fill="#F5EDDD" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 34 v13 M24 50 h16" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="27" cy="23" r="3" fill="#C05B33" opacity=".6"/>
    <path d="M12 57 q10 -6 20 0 q10 6 20 0" fill="none" stroke="#C05B33" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`),

  ballpark: scene('#E7E4D4', `
    <path d="M32 22 L48 38 L32 54 L16 38 Z" fill="#DCE3D2" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="38" r="3.2" fill="#E8D9BE" stroke="${I}" stroke-width="1.8"/>
    <path d="M12 26 V12 M52 26 V12" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="12" cy="10" r="3.4" fill="#B08430" opacity=".6" stroke="${I}" stroke-width="1.8"/>
    <circle cx="52" cy="10" r="3.4" fill="#B08430" opacity=".6" stroke="${I}" stroke-width="1.8"/>`),

  trivia: scene('#EFE6DA', `
    <path d="M14 12 h22 l-8 6 8 6 h-22 z" fill="#5C2B52" opacity=".4" stroke="${I}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M14 12 v20" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="30" y="32" width="14" height="20" rx="2" fill="#EFC868" opacity=".55" stroke="${I}" stroke-width="2.5"/>
    <path d="M29 32 q8 -5 16 0" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <path d="M12 57h40" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`),

  bagel: scene('#F2E8D8', `
    <path d="M8 14 h48" stroke="${I}" stroke-width="2.5"/>
    <path d="M8 14 q4 8 8 0 q4 8 8 0 q4 8 8 0 q4 8 8 0 q4 8 8 0 q4 8 8 0" fill="#C05B33" opacity=".35" stroke="${I}" stroke-width="2"/>
    <circle cx="32" cy="41" r="14" fill="#EDC98A" opacity=".6" stroke="${I}" stroke-width="2.5"/>
    <circle cx="32" cy="41" r="5" fill="#F2E8D8" stroke="${I}" stroke-width="2.5"/>
    <path d="M24 34 l3 2 M40 33 l-3 2 M27 49 l2 -3 M38 48 l-2 -3" stroke="${I}" stroke-width="1.8" stroke-linecap="round"/>`),

  books: scene('#EFE9DB', `
    <path d="M32 24 q-10 -6 -20 -2 v26 q10 -4 20 2 q10 -6 20 -2 v-26 q-10 -4 -20 2 z" fill="#F8F2E4" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 24 v26" stroke="${I}" stroke-width="2.2"/>
    <path d="M17 30 q8 -3 12 0 M17 36 q8 -3 12 0 M35 30 q8 -3 12 0 M35 36 q8 -3 12 0" fill="none" stroke="${I}" stroke-width="1.6"/>
    <circle cx="49" cy="15" r="1.8" fill="#B08430"/>`),

  market: scene('#F1E7D6', `
    <rect x="8" y="18" width="48" height="8" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <path d="M12 18 v8 M20 18 v8 M28 18 v8 M36 18 v8 M44 18 v8 M52 18 v8" stroke="#C05B33" stroke-width="3" opacity=".45"/>
    <path d="M20 26 v6 M44 26 v6" stroke="${I}" stroke-width="2.2"/>
    <circle cx="32" cy="38" r="3" fill="#B08430" opacity=".7"/>
    <path d="M32 26 v9" stroke="${I}" stroke-width="1.8"/>
    <rect x="16" y="46" width="14" height="10" fill="none" stroke="${I}" stroke-width="2.2"/>
    <rect x="36" y="46" width="14" height="10" fill="#7C8A66" opacity=".3" stroke="${I}" stroke-width="2.2"/>`),

  campus: scene('#ECE9DB', `
    <path d="M14 40 h26 v-18 h-26 z" fill="#F8F2E4" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="17" y="25" width="20" height="12" fill="#B08430" opacity=".25"/>
    <path d="M10 40 h34 l4 8 h-42 z" fill="#EFE6CF" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="50" cy="47" r="5" fill="#F8F2E4" stroke="${I}" stroke-width="2.5"/>
    <path d="M48 42 q2 -3 4 0" fill="none" stroke="${I}" stroke-width="1.8"/>`),

  library: scene('#EFEBDE', `
    <path d="M12 24 L32 12 L52 24 z" fill="#F6F0E1" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M17 28 v18 M27 28 v18 M37 28 v18 M47 28 v18" stroke="${I}" stroke-width="3"/>
    <path d="M12 50 h40 M9 56 h46" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`),

  coffee: scene('#F2EADC', `
    <path d="M20 30 h22 v12 a8 8 0 0 1 -8 8 h-6 a8 8 0 0 1 -8 -8 z" fill="#F8F1E6" stroke="${I}" stroke-width="2.5"/>
    <path d="M42 33 h5 a4 4 0 0 1 0 9 h-5" fill="none" stroke="${I}" stroke-width="2.5"/>
    <path d="M26 24 q-2 -4 1 -7 M32 24 q-2 -4 1 -7" fill="none" stroke="${I}" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 56 q10 -8 22 -3" fill="none" stroke="#B08430" stroke-width="4" stroke-linecap="round" opacity=".5"/>`),

  fountain: scene('#E9EBDD', `
    <path d="M24 14 h16 M28 14 v6 h8 v-6" stroke="${I}" stroke-width="2.2" fill="none"/>
    <path d="M20 26 h24 M26 26 v6 M38 26 v6" stroke="${I}" stroke-width="2.2"/>
    <path d="M14 38 h36 M20 38 v6 M44 38 v6" stroke="${I}" stroke-width="2.2"/>
    <path d="M10 50 h44 v5 h-44 z" fill="#CCDAD3" opacity=".8" stroke="${I}" stroke-width="2.2"/>
    <path d="M22 20 q-2 3 0 5 M42 20 q2 3 0 5 M18 32 q-2 3 0 5 M46 32 q2 3 0 5" fill="none" stroke="#7C8A66" stroke-width="2" stroke-linecap="round"/>`),

  river: scene('#E4E9E0', `
    <path d="M6 30 h52" stroke="${I}" stroke-width="2.5"/>
    <path d="M10 30 a8 8 0 0 0 16 0 M26 30 a8 8 0 0 0 16 0 M42 30 a8 8 0 0 0 16 0" fill="none" stroke="${I}" stroke-width="2.2"/>
    <ellipse cx="30" cy="48" rx="13" ry="3.4" fill="#C05B33" opacity=".45" stroke="${I}" stroke-width="2"/>
    <path d="M30 44 v-5 M24 41 l12 -4" stroke="${I}" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 56 q6 -4 12 0 q6 4 12 0 q6 -4 12 0 q6 4 12 0" fill="none" stroke="#A9B4A6" stroke-width="2.2" stroke-linecap="round"/>`),

  monument: scene('#EAE7DA', `
    <path d="M28 52 L30 14 L32 10 L34 14 L36 52 z" fill="#F6F0E1" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="48" cy="17" r="6" fill="#F8F2E4" stroke="${I}" stroke-width="2.2"/>
    <circle cx="14" cy="26" r="1.6" fill="${I}"/><circle cx="20" cy="14" r="1.6" fill="${I}"/>
    <path d="M10 56 h44" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 52 q16 -6 32 0" fill="none" stroke="#7C8A66" stroke-width="2.2" opacity=".7"/>`),

  pier: scene('#EDE6D5', `
    <circle cx="47" cy="17" r="7" fill="#C05B33" opacity=".4"/>
    <path d="M6 40 h52" stroke="${I}" stroke-width="2.5"/>
    <path d="M12 40 v10 M24 40 v12 M36 40 v10 M48 40 v12" stroke="${I}" stroke-width="2.2"/>
    <path d="M26 34 a6 6 0 0 1 12 0" fill="#F5EDDD" stroke="${I}" stroke-width="2.2"/>
    <path d="M30 28 q2 -4 0 -6 M34 28 q-2 -4 0 -6" fill="none" stroke="#C05B33" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 56 q7 -4 14 0 q7 4 14 0 q7 -4 14 0" fill="none" stroke="#A9B4A6" stroke-width="2.2" stroke-linecap="round"/>`),

  club: scene('#EBDFE7', `
    <circle cx="32" cy="26" r="11" fill="#F6F0E8" stroke="${I}" stroke-width="2.5"/>
    <path d="M21 26 h22 M32 15 v22 M24 19 q8 5 16 0 M24 33 q8 -5 16 0" fill="none" stroke="${I}" stroke-width="1.8"/>
    <path d="M32 10 v-4" stroke="${I}" stroke-width="2.2"/>
    <path d="M18 42 L12 54 M32 44 v12 M46 42 L52 54" stroke="#5C2B52" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
    <circle cx="14" cy="34" r="1.7" fill="#5C2B52" opacity=".7"/><circle cx="50" cy="30" r="1.7" fill="#5C2B52" opacity=".7"/>`),

  arena: scene('#EAE4D8', `
    <path d="M8 34 q24 16 48 0 v10 q-24 14 -48 0 z" fill="#F5EEDF" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="24" y="12" width="16" height="11" rx="2" fill="#F8F2E4" stroke="${I}" stroke-width="2.2"/>
    <path d="M32 23 v6" stroke="${I}" stroke-width="2"/>
    <path d="M32 14.5 l1.6 3.4 3.7.4 -2.8 2.5 .8 3.6 -3.3 -1.9 -3.3 1.9 .8 -3.6 -2.8 -2.5 3.7 -.4 z" fill="#C05B33" opacity=".55"/>`),

  rooftop: scene('#F0E5D3', `
    <rect x="8" y="30" width="10" height="16" fill="#E7DCC4" stroke="${I}" stroke-width="2"/>
    <rect x="22" y="24" width="12" height="22" fill="#EFE6CF" stroke="${I}" stroke-width="2"/>
    <rect x="38" y="28" width="10" height="18" fill="#E7DCC4" stroke="${I}" stroke-width="2"/>
    <rect x="50" y="34" width="8" height="12" fill="#EFE6CF" stroke="${I}" stroke-width="2"/>
    <path d="M6 20 Q32 30 58 20" fill="none" stroke="${I}" stroke-width="1.8"/>
    <circle cx="18" cy="23" r="2" fill="#B08430"/><circle cx="32" cy="26" r="2" fill="#B08430"/><circle cx="46" cy="23" r="2" fill="#B08430"/>
    <path d="M6 50 h52 M10 50 v6 M22 50 v6 M34 50 v6 M46 50 v6 M56 50 v6" stroke="${I}" stroke-width="2"/>`),

  wine: scene('#EFE4DC', `
    <path d="M20 12 h6 v10 q5 3 5 9 v21 h-16 v-21 q5 -6 5 -9 z" fill="#F6EEE2" stroke="${I}" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="16" y="34" width="15" height="9" fill="#5C2B52" opacity=".3"/>
    <path d="M38 20 h16 v6 a8 8 0 0 1 -16 0 z" fill="#5C2B52" opacity=".35" stroke="${I}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M46 34 v14 M40 52 h12" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`),

  taco: scene('#F2E6D4', `
    <path d="M12 44 a20 20 0 0 1 40 0 z" fill="#EDC98A" opacity=".7" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M16 42 q4 -5 8 0 q4 -5 8 0 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#7C8A66" stroke-width="2.4"/>
    <path d="M20 38 q3 -3 6 0 M34 37 q3 -3 6 0" fill="none" stroke="#C05B33" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M14 52 h36" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`),

  gogo: scene('#EFE3D8', `
    <path d="M20 22 h24 l-4 30 h-16 z" fill="#F6EEE0" stroke="${I}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="32" cy="22" rx="12" ry="4" fill="#C05B33" opacity=".4" stroke="${I}" stroke-width="2.2"/>
    <path d="M24 30 l-8 -8 M40 30 l8 -8" stroke="${I}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M12 14 q2 -2 4 0 M48 14 q2 -2 4 0" fill="none" stroke="#C05B33" stroke-width="2" stroke-linecap="round"/>`),
}

MARKER_ART.atrium = scene('#EFEADB', `
  <path d="M8 30 Q32 10 56 30" fill="none" stroke="${I}" stroke-width="2.4"/>
  <path d="M14 26 L26 36 M26 18 L38 36 M38 14 L50 32 M20 21 L14 26 M32 15 L26 18 M44 13 L38 14" stroke="${I}" stroke-width="1.5" opacity=".7"/>
  <path d="M12 40 h40 M12 40 v14 M52 40 v14" stroke="${I}" stroke-width="2.4"/>
  <path d="M20 47 h8 M36 47 h8" stroke="#B08430" stroke-width="3" opacity=".6" stroke-linecap="round"/>
  <path d="M8 56 h48" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`)

MARKER_ART.film = scene('#EDE3D2', `
  <rect x="12" y="18" width="40" height="14" rx="3" fill="#F7F0E1" stroke="${I}" stroke-width="2.4"/>
  <path d="M16 22 h6 M26 22 h6 M36 22 h6 M16 27 h6 M26 27 h6 M36 27 h6" stroke="#C05B33" stroke-width="2.2" opacity=".6" stroke-linecap="round"/>
  <path d="M12 18 L8 12 M52 18 L56 12 M8 12 h48" stroke="${I}" stroke-width="2.2"/>
  <rect x="24" y="38" width="16" height="16" rx="2" fill="none" stroke="${I}" stroke-width="2.4"/>
  <path d="M24 44 h16 M30 38 v-4" stroke="${I}" stroke-width="1.8"/>`)

MARKER_ART.columns = scene('#EAEBDB', `
  <path d="M14 22 h36" stroke="${I}" stroke-width="2.6"/>
  <path d="M18 24 v20 M28 24 v20 M38 24 v20 M48 24 v20" stroke="${I}" stroke-width="3.4"/>
  <path d="M16 20 h4 M26 20 h4 M36 20 h4 M46 20 h4" stroke="${I}" stroke-width="2.2"/>
  <path d="M10 48 q22 -6 46 0" fill="none" stroke="#7C8A66" stroke-width="3" opacity=".7"/>
  <circle cx="52" cy="14" r="4" fill="#B08430" opacity=".5"/>`)

MARKER_ART.tunnel = scene('#E7DFD4', `
  <path d="M12 54 v-20 a20 20 0 0 1 40 0 v20" fill="#DCD1C0" stroke="${I}" stroke-width="2.5"/>
  <path d="M20 54 v-18 a12 12 0 0 1 24 0 v18" fill="#4B3D33" opacity=".5" stroke="${I}" stroke-width="2.2"/>
  <path d="M26 40 l4 4 l-4 4 M38 40 l-4 4 l4 4" stroke="#C05B33" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M8 54 h48" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`)

MARKER_ART.steps = scene('#E9E2D3', `
  <path d="M46 10 v8 h-8 v8 h-8 v8 h-8 v8 h-8 v8 h-8" fill="none" stroke="${I}" stroke-width="2.6"/>
  <path d="M46 10 h8 M14 50 v6" stroke="${I}" stroke-width="2.2"/>
  <path d="M50 24 q-2 6 -6 8 M54 30 q-4 8 -10 10" stroke="#7C8A66" stroke-width="2" fill="none" opacity=".7"/>
  <circle cx="20" cy="44" r="2.6" fill="#C05B33" opacity=".7"/>`)

MARKER_ART.diner = scene('#F0E6D3', `
  <rect x="10" y="24" width="44" height="22" rx="4" fill="#F8F1E2" stroke="${I}" stroke-width="2.5"/>
  <path d="M10 32 h44" stroke="${I}" stroke-width="2"/>
  <path d="M16 28 h8 M28 28 h8 M40 28 h8" stroke="#C05B33" stroke-width="2.4" opacity=".6" stroke-linecap="round"/>
  <path d="M18 38 h6 M30 38 h6 M42 38 h6" stroke="${I}" stroke-width="2" stroke-linecap="round"/>
  <path d="M20 20 q-2 -4 1 -7 M32 20 q-2 -4 1 -7 M44 20 q-2 -4 1 -7" fill="none" stroke="${I}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M14 50 h36" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`)

MARKER_ART.dome = scene('#ECE8DA', `
  <path d="M20 34 a12 15 0 0 1 24 0" fill="#F6F0E1" stroke="${I}" stroke-width="2.5"/>
  <path d="M30 16 h4 M32 12 v7" stroke="${I}" stroke-width="2.2"/>
  <path d="M18 34 h28 M20 40 h24" stroke="${I}" stroke-width="2.4"/>
  <path d="M22 40 v8 M28 40 v8 M36 40 v8 M42 40 v8" stroke="${I}" stroke-width="2.6"/>
  <path d="M14 48 h36 M10 55 h44" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`)

MARKER_ART.cathedral = scene('#EBE6D9', `
  <path d="M14 54 V26 l6 -8 6 8 v28 M38 54 V26 l6 -8 6 8 v28" fill="#F5EFE0" stroke="${I}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M20 14 v-5 M44 14 v-5" stroke="${I}" stroke-width="2"/>
  <path d="M26 54 v-16 a6 8 0 0 1 12 0 v16" fill="#DCD2C0" stroke="${I}" stroke-width="2.4"/>
  <circle cx="32" cy="28" r="4" fill="none" stroke="#8A4A6B" stroke-width="2" opacity=".8"/>
  <path d="M10 54 h44" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/>`)

const cache = {}
export function artUrl(key) {
  if (!MARKER_ART[key]) return null
  cache[key] ||= `data:image/svg+xml;utf8,${encodeURIComponent(MARKER_ART[key])}`
  return cache[key]
}
