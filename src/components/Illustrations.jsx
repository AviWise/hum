// Authored scene illustrations for demo posts — one linework grammar: 2px taupe
// ink on warm grounds, a single soft wash per scene. Drawn, not photographed,
// until real user photos exist.

const INK = '#6E6151'

function Frame({ children, sky }) {
  return (
    <svg viewBox="0 0 240 120" className="illo" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="120" fill={sky} />
      {children}
    </svg>
  )
}

export function Stage() {
  return (
    <Frame sky="#EFE4DE">
      <rect x="0" y="88" width="240" height="32" fill="#E3D2C9" />
      <rect x="52" y="26" width="136" height="62" rx="3" fill="#F7EFEA" stroke={INK} strokeWidth="2" />
      <path d="M60 26 L84 60 M120 26 L120 64 M180 26 L156 60" stroke="#C05B33" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
      <circle cx="84" cy="62" r="7" fill="#C05B33" opacity=".28" />
      <circle cx="120" cy="66" r="7" fill="#C05B33" opacity=".28" />
      <circle cx="156" cy="62" r="7" fill="#C05B33" opacity=".28" />
      <path d="M40 104 q6 -12 12 0 M64 106 q6 -14 12 0 M88 104 q6 -11 12 0 M112 106 q6 -13 12 0 M136 104 q6 -12 12 0 M160 106 q6 -13 12 0 M184 104 q6 -11 12 0"
        fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <rect x="46" y="18" width="148" height="8" rx="4" fill="none" stroke={INK} strokeWidth="2" />
    </Frame>
  )
}

export function Rowhouse() {
  return (
    <Frame sky="#EFE6D8">
      <rect x="0" y="92" width="240" height="28" fill="#E6DAC4" />
      {[
        { x: 18, w: 48, h: 56, wash: '#5C2B52' },
        { x: 70, w: 44, h: 64, wash: '#C05B33' },
        { x: 118, w: 50, h: 52, wash: '#B08430' },
        { x: 172, w: 46, h: 60, wash: '#7C8A66' },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={92 - b.h} width={b.w} height={b.h} fill="#F8F1E6" stroke={INK} strokeWidth="2" />
          <rect x={b.x} y={92 - b.h} width={b.w} height="10" fill={b.wash} opacity=".3" stroke={INK} strokeWidth="2" />
          <rect x={b.x + 8} y={92 - b.h + 18} width="10" height="12" fill={b.wash} opacity=".35" stroke={INK} strokeWidth="1.6" />
          <rect x={b.x + b.w - 18} y={92 - b.h + 18} width="10" height="12" fill={b.wash} opacity=".35" stroke={INK} strokeWidth="1.6" />
          <rect x={b.x + b.w / 2 - 6} y="74" width="12" height="18" fill="none" stroke={INK} strokeWidth="1.6" />
          <path d={`M${b.x + b.w / 2 - 10} 92 h20`} stroke={INK} strokeWidth="2" />
        </g>
      ))}
      <path d="M30 106 h180" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 10" />
    </Frame>
  )
}

export function Ballpark() {
  return (
    <Frame sky="#E9E4D6">
      <path d="M20 96 Q120 30 220 96 Z" fill="#F5EDDD" stroke={INK} strokeWidth="2" />
      <path d="M52 92 Q120 52 188 92 Z" fill="#DCE3D2" stroke={INK} strokeWidth="2" />
      <path d="M96 90 L120 74 L144 90 L120 98 Z" fill="#E8D9BE" stroke={INK} strokeWidth="2" />
      <g stroke={INK} strokeWidth="2">
        <path d="M40 60 V38 M200 60 V38" />
        <circle cx="40" cy="34" r="5" fill="#B08430" opacity=".6" stroke={INK} />
        <circle cx="200" cy="34" r="5" fill="#B08430" opacity=".6" stroke={INK} />
      </g>
      <path d="M60 104 q5 -10 10 0 M84 106 q5 -12 10 0 M108 104 q5 -10 10 0 M132 106 q5 -11 10 0 M156 104 q5 -10 10 0"
        fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </Frame>
  )
}

export function Pier() {
  return (
    <Frame sky="#EBE3D2">
      <circle cx="196" cy="30" r="14" fill="#C05B33" opacity=".35" />
      <rect x="0" y="78" width="240" height="42" fill="#D9DFD6" />
      <path d="M0 78 h240" stroke={INK} strokeWidth="2" />
      <path d="M12 78 h132 v14 h-132 z" fill="#EFE6D3" stroke={INK} strokeWidth="2" />
      <path d="M24 92 v16 M60 92 v20 M96 92 v16 M132 92 v20" stroke={INK} strokeWidth="2" />
      <g stroke={INK} strokeWidth="2" fill="none">
        <path d="M40 78 V58 M104 78 V58" />
        <path d="M40 58 Q72 46 104 58" />
        <circle cx="56" cy="60" r="3" fill="#C05B33" opacity=".5" />
        <circle cx="72" cy="56" r="3" fill="#B08430" opacity=".5" />
        <circle cx="88" cy="60" r="3" fill="#7C8A66" opacity=".5" />
      </g>
      <path d="M160 96 q8 -8 16 0 q8 8 16 0 q8 -8 16 0" fill="none" stroke="#A9B4A6" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M168 62 l10 14 h-20 z" fill="#F5EDDD" stroke={INK} strokeWidth="2" />
    </Frame>
  )
}

export const ILLOS = { stage: Stage, rowhouse: Rowhouse, ballpark: Ballpark, pier: Pier }
