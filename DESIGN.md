---
name: out.
description: A warm editorial city map of D.C. — going out, styled like wellness.
colors:
  bone: "#f7f3ec"
  card: "#fdfbf6"
  ink: "#21201c"
  ink-soft: "#6e6355"
  hairline: "#e6ddcc"
  plum: "#4b2144"
  plum-deep: "#3c1a37"
  night: "#5C2B52"
  terracotta: "#C05B33"
  terracotta-deep: "#9C4522"
  caramel: "#B08430"
  caramel-deep: "#7D621E"
  sage: "#7C8A66"
  sage-deep: "#57654A"
typography:
  display:
    fontFamily: "'Source Serif 4', 'Iowan Old Style', Georgia, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Source Serif 4', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Source Serif 4', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Source Serif 4', 'Iowan Old Style', Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  ui:
    fontFamily: "'Hanken Grotesk', 'Avenir Next', 'Helvetica Neue', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 650
    letterSpacing: "0.02em"
  label:
    fontFamily: "'Hanken Grotesk', 'Avenir Next', 'Helvetica Neue', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    letterSpacing: "0.14em"
rounded:
  pill: "999px"
  sheet: "1.75rem"
  card: "1.25rem"
  inset: "1rem"
  field: "0.9rem"
spacing:
  xs: "0.45rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.25rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.4rem"
    typography: "{typography.ui}"
  button-primary-hover:
    backgroundColor: "{colors.plum-deep}"
  pill:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 0.95rem"
  pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
  chip-venue:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.8rem"
  card-event:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
  sheet:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.sheet}"
    padding: "0.6rem 1.5rem 1.5rem"
  input:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.75rem 0.9rem"
---

# Design System: out.

## Overview

**Creative North Star: "Going Out, Styled Like Wellness"**

A live nightlife map that refuses the category's dark neon slippy map and glass
sheets. The city sits on warm bone linen: the map is a real vector-tile city
(MapLibre GL over OpenFreeMap), but its provider style is recolored at runtime
into the world's palette — bone ground, warm-white streets, sage parks, pale
water, taupe labels — so the map wears the brand, not the other way around.
Busyness renders as a blush heat wash beneath the street labels. The register
is Hinge's editorial warmth (serif voice, rounded photo-forward cards, deep
plum accent) executed with Alo's wellness-luxury restraint (bone/sand ground,
tracked uppercase micro-labels, muted earth tones, soft diffuse shadows,
generous calm).

Everything content-like speaks in serif; everything metadata-like whispers in
tracked-caps grotesk. Color is earth-toned and semantic — four category earths
(night plum, eats terracotta, study caramel, outside sage) tint the whole
system, from map markers to sheet washes. Nothing is pure black, pure white,
or cool gray; even shadows and the modal scrim are warm umber.

**Key Characteristics:**
- Bone `#f7f3ec` ground everywhere; cards float on it in warm ivory `#fdfbf6`
- Editorial serif display (Source Serif 4) over tracked-caps Hanken Grotesk labels
- Four earth-tone categories that tint surfaces at low strength, never paint them
- Fully rounded form language: pills, 20px cards, 28px sheets — zero sharp corners
- Soft, warm, diffuse shadows; one soft ease (`--ease-out-soft`) for all motion
- A real map in the world's clothes: provider geometry, warmified paint —
  while content "photos" remain authored linework drawings

## Colors

Warm bone neutrals carry the frame; a deep plum leads; four muted category
earths do the semantic work.

### Primary
- **Plum** (`#4b2144`): the brand accent — the wordmark's period, the Post
  button, focus rings, text selection, caret. Rare on any one screen; the only
  saturated call to action.
- **Plum Deep** (`#3c1a37`): plum's hover/pressed state.

### Secondary (category earths — semantic, one per category)
- **Night Plum** (`#5C2B52`): "Out late" markers, bands, meters. Its deep pair
  is brand Plum (`#4b2144`) — the nightlife category and the brand share a
  root.
- **Terracotta** (`#C05B33`): "Eats" category; also the heat wash's core hue.
- **Terracotta Deep** (`#9C4522`): eats text-on-light; doubles as the urgency
  voice — closing countdowns (`<30m left`) and form errors.
- **Caramel** (`#B08430`) / **Caramel Deep** (`#7D621E`): "Coffee & study".
- **Sage** (`#7C8A66`) / **Sage Deep** (`#57654A`): "Outside".

Each earth is a `color`/`deep` pair: full color for marks on the bone ground
(marker dots, pill dots, meter fills, card bands); the deep for text so labels
hold contrast on cream.

### Neutral
- **Bone** (`#f7f3ec`): the ground — page, map fallback, insets inside cards.
- **Card** (`#fdfbf6`): floating surfaces (cards, sheets, pills, panels) and
  marker rings; one step brighter than bone, never pure white.
- **Ink** (`#21201c`): primary text and the selected-pill fill. Warm
  near-black; the system has no `#000`.
- **Ink Soft** (`#6e6355`): micro-labels, metadata, secondary text.
- **Hairline** (`#e6ddcc`): 1px borders on pills, chips, fields; the sheet
  grab handle.

Map materials (component-scoped — the `warmify()` recolor applied to the tile
provider's style): ground `#f5f1e6`, streets `#fdfbf4` with `#e2d8bf` casings
and `#f2e2c2` motorways, parks `#e2e7d2`, water `#ccdad3`, buildings `#ebe3cf`
(outline `#ddd1b6`), residential/land washes `#f2ede0`–`#f1ecdd`, rail
`#ded3ba`, boundaries `#d2c5a9`; map text in warm taupe `#77694f` (`#88a094`
on water) with bone halos `rgba(247,243,236,0.92)`; marker labels `#5f5442`.

### Named Rules
**The Tint, Never Paint Rule.** Category color fills only small marks —
marker dots, pill dots, 0.5rem bands, meter fills. On surfaces it appears only
as a wash: the spot sheet mixes its category color at 7% into the card
(`color-mix(in srgb, var(--tint) 7%, var(--card))`). No large area is ever a
full-strength earth.

**The Warmify Rule.** Third-party surfaces are repainted, never adopted: the
tile style is fetched and recolored into the world's palette at runtime
(geometry stays the provider's; only paint changes), and MapLibre chrome
(attribution) is restyled into bone pills and micro type. Nothing on screen
wears provider colors.

**The Warmth Is Data Rule.** The blush heat ramp (transparent `#D97A50` →
`rgba(232,195,166,0.32)` → `rgba(188,91,51,0.72)`) exists only as the map's
busyness layer, rendered beneath the map's label layers — and it never carries
meaning alone: crowd words ("Packed"), meters, and the legend restate it in
text.

**The No Cold Pixels Rule.** Every neutral is warm: shadows are umber
`rgba(74,63,46,…)`, the scrim is `rgba(46,38,28,0.35)`, near-black is
`#21201c`. Never introduce gray, pure black, or pure white.

## Typography

**Display Font:** Source Serif 4, variable 400–700 upright + italic
(self-hosted; fallback Iowan Old Style, Georgia)
**Body/UI Font:** Hanken Grotesk, variable 400–700 (self-hosted; fallback
Avenir Next, Helvetica Neue)

**Character:** an editorial serif with real italics carries every human voice —
place names, vibe lines, event titles — while a clean grotesk, always slightly
heavy (550–650) and often tracked-caps, handles buttons, labels, and metadata.
The pairing reads like a warm city magazine, not an app.

### Hierarchy
- **Display / wordmark** (serif 600, 2rem mobile / 2.4rem desktop, lh 1,
  ls −0.01em): the lowercase `out.` wordmark; its period is plum.
- **Headline** (serif 600, 1.75rem, ls −0.015em): sheet spot names.
- **Title** (serif 600, 1.25rem, ls −0.01em): panel headings ("Tonight",
  "Right now").
- **Body serif** (serif 400, 1.125rem, lh 1.5, max-width 32ch): the quoted
  vibe line; event titles step down to 1rem / lh 1.35 (two-line clamp).
- **UI sans** (sans 650, 0.9375rem, ls 0.02em): buttons; pills at 0.8125rem;
  chips at 550.
- **Micro label** (sans 650, 0.6875rem, ls 0.14em, UPPERCASE, ink-soft): the
  `.micro` atom — section labels, metadata, the clock, countdowns
  (tabular-nums). Map marker labels are its heavier cousin (0.72rem, 700,
  ls 0.09em, caps, bone text-shadow halo).

### Named Rules
**The Serif Speaks, Sans Labels Rule.** Anything a person would say or a place
is called is serif; anything the interface says about it is grotesk. Never a
serif button; never a grotesk spot name.

**The Italic Whisper Rule.** Serif italic is reserved for the soft register:
empty states ("Quiet for now — be the first to post."), and textarea
placeholders. It never carries primary content.

## Layout

The map is the app: a full-bleed MapLibre GL canvas with UI floating over it,
fading at the top via a bone gradient scrim. One breakpoint at **900px**.

- **Mobile (default):** vertical thumb-reach stack pinned to the bottom —
  legend + plum Post FAB, a horizontally scrolling filter-pill row, then the
  "Tonight" card rail (snap-x, 15.5rem cards). Topbar holds wordmark left,
  live clock right. The map opens fitted to the busy core (not the whole
  city) and pans outward. Sheets rise bottom-anchored to `max-height: 86dvh`,
  respecting `env(safe-area-inset-bottom)`.
- **Desktop (≥900px):** the stack dissolves (`display: contents`) into
  floating panels: filters centered at top, "Right now" panel top-left
  (16.5rem), "Tonight" dock bottom-right (19.5rem, vertical scroll), legend
  and FAB bottom-left, zoom buttons beside the dock, map attribution pill
  top-right below the clock. The map's initial `fitBounds` frames the whole
  city inside the panel insets (padding ≈ 110/60/316/372).
- **Rhythm:** 1.25rem screen-edge padding (2rem desktop), 0.75rem between
  cards, 0.5rem between pills, ~1.1–1.5rem vertical blocks inside sheets.
  Card interiors pad 0.7–0.9rem; panels 1.1–1.2rem.

## Elevation & Depth

Layered and lifted, but soft: surfaces float on the bone ground under large,
low-opacity, warm-umber shadows — diffusion, never hard edges. Depth also
comes from tone (bone insets inside ivory cards) and the warm scrim behind
sheets.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 10px 30px -12px rgba(74, 63, 46, 0.28), 0 2px 8px
  -2px rgba(74, 63, 46, 0.1)`): resting elevation — pills, cards, panels,
  legend, zoom buttons.
- **Lift** (`box-shadow: 0 18px 50px -16px rgba(58, 46, 30, 0.4), 0 4px 12px
  -4px rgba(74, 63, 46, 0.12)`): the top layer — sheets, the plum Post
  button, event-card hover.
- **Marker** (`box-shadow: 0 2px 8px rgba(74, 63, 46, 0.4)`): map marker dots;
  selection adds a soft category ring
  (`0 0 0 4px color-mix(in srgb, var(--c) 30%, transparent)`).

### Named Rules
**The Two Shadows Rule.** Every floated element uses `--shadow-soft` or
`--shadow-lift` (map marker dots carry their own smaller warm shadow) —
nothing else. Hover promotes soft to lift; no new shadow values.

## Shapes

Fully rounded, no exceptions: controls are stadium pills (`999px`), cards are
1.25rem (20px), inner insets 1rem, fields 0.9rem, sheets 1.75rem (28px —
top-only on mobile, all corners on desktop). Borders are 1px hairline
`#e6ddcc` on pills, chips, and fields; larger surfaces are borderless and rely
on shadow. Map markers share the language: circular category dots (18–26px,
sized by busyness) with 3px ivory rings and circular ivory count badges; even
the attribution control is a bone pill. (The direction contract said "24px
rounded cards"; the build settled on 20px cards / 28px sheets — the build
wins.)

## Components

### Buttons
- **Primary** ("Post", sheet CTA): plum fill, bone text, stadium shape,
  `0.85rem 1.4rem` padding, sans 650 at 0.9375rem, lift shadow. Hover →
  plum-deep; active → `scale(0.96)`; inline SVG glyphs ~0.95rem.
- **Icon buttons** (zoom, sheet close): 2.1–2.5rem circles, card or bone fill,
  soft shadow, ink/ink-soft glyph; hover brightens fill, active `scale(0.9)`.
- There is no secondary/ghost button; pills cover selection.

### Pills (filters)
- Card fill, hairline border, soft shadow, stadium shape; 0.8125rem sans 650;
  a 0.5rem category dot with an ivory ring leads each label.
- **Active:** fills with the category's deep color (plum-tinted ink fallback),
  bone text. Active press `scale(0.95)`.

### Chips (venues)
- Quieter than pills: bone fill, hairline border, stadium, 0.8125rem at 550,
  no shadow, static.

### Cards (event cards)
- 1.25rem radius, card fill, soft shadow, clipped overflow. Top edge carries
  either an authored linework illustration (5.5rem) or a 0.5rem category-color
  band. Body: micro meta row (spot name in category deep + countdown), then a
  serif title clamped to two lines. Desktop hover lifts the shadow.
- **Death:** expired cards get `.dying` — a slow 0.9s fade + shrink before
  removal. Expiry is a feature; it must be seen.

### Inputs / Fields
- Selects and textareas: bone fill, hairline border, 0.9rem radius,
  `0.75rem 0.9rem` padding. Textarea is **serif** 1.0625rem (the user writes
  in the content voice) with an italic placeholder; selects are sans with a
  custom inline chevron. Focus: 2px plum outline. Errors: terracotta-deep
  text.

### Sheets
- Bottom sheets (mobile) / centered dialogs (desktop): card fill, 1.75rem
  radius, lift shadow, hairline grab handle, warm scrim behind. The spot
  sheet tints itself 7% with its category color and enters with a 0.45s
  `sheetUp` spring on `--ease-out-soft`.

### Navigation
- No nav chrome. The topbar is wordmark + tracked-caps sublabel and a live
  tabular-nums clock over a bone fade scrim; wayfinding is the map itself.

### City Map (signature)
- **Basemap:** MapLibre GL JS over OpenFreeMap vector tiles (Positron style),
  recolored at runtime by `warmify()` into the map materials above — a full
  real city map wearing the world's paint. Rotation and pitch are disabled;
  zoom is clamped 10.5–17.5; the required attribution control sits top-right,
  restyled as a bone micro pill.
- **Heat:** busyness is a MapLibre heatmap layer over the spot data, using
  the terracotta→blush ramp, inserted *below* the first symbol layer so street
  names stay legible over the wash; it filters live with the category pills.
  The heat breathes — a six-second sine on `heatmap-opacity` between 0.52 and
  0.80 (interval-driven `setPaintProperty`; skipped entirely under
  `prefers-reduced-motion`). The living field is a signature, not decoration.
- **Markers:** spots are HTML markers (`.gmark`): a category-color dot sized
  by busyness (18–26px, `16 + busy/9`) with a 3px ivory ring and warm marker
  shadow; an ivory circular post-count badge (`9+` cap); a tracked-caps taupe
  label (`#5f5442`, 0.72rem/700/0.09em) halo'd in bone via text-shadow, above
  or below per spot. Hover scales the dot 1.12; selection scales 1.18 and adds
  the 30% category ring; filtered-out markers drop to 0.12 opacity; minor
  spots hide their labels below zoom 12.4 (0.3s fade). Keyboard focus swaps
  the ring to plum.

### Illustrations (signature)
- Every post "photo" is a drawn scene: one grammar of 2px taupe ink `#6E6151`
  on a warm ground, with a single low-opacity category-earth wash per scene.
  Drawn, not photographed, until real user photos exist.

## Do's and Don'ts

### Do:
- **Do** keep plum scarce: one primary action per screen wears `#4b2144`;
  everything else selects with ink or category deeps.
- **Do** tint, never paint: category color on surfaces only as a ≤7% wash;
  full strength only on marks smaller than ~1.75rem (marker dots included).
- **Do** repaint any third-party surface into the world (the Warmify Rule):
  provider geometry may stay, provider colors may not.
- **Do** use `--ease-out-soft` (`cubic-bezier(0.32, 0.72, 0, 1)`) for every
  entrance and transform; entrances are `fadeUp`/`fadeDown` (0.7–0.9s,
  staggered ~0.2s), removals are slow 0.9s fades.
- **Do** pair every heat/color signal with a text channel (crowd word, meter
  label, legend, count) — never color alone.
- **Do** set countdowns and the clock in tabular-nums micro caps, flipping to
  terracotta-deep under 30 minutes.
- **Do** respect `prefers-reduced-motion` (the build collapses all animation
  to 0.01ms) and `env(safe-area-inset-bottom)` on bottom-anchored UI.

### Don't:
- **Don't** introduce cool neutrals: no pure white, no `#000`, no gray
  shadows or scrims — warm umber only.
- **Don't** add gradients beyond the two native ones (the map's heat ramp and
  the topbar's bone fade); cards, buttons, and sheets are flat fills.
- **Don't** show a default-styled map or provider chrome — the basemap and
  its controls always pass through the warmify treatment.
- **Don't** use photography for post content; until real user photos exist,
  content imagery is authored linework in the one ink grammar.
- **Don't** sharpen a corner or add a fourth shadow value; the form language
  is pills, 20px cards, 28px sheets, soft/lift/marker.
- **Don't** set UI chrome in serif or content in grotesk; the two voices never
  swap jobs.
- **Don't** show stale content as current — expiring things visibly die (the
  0.9s `.dying` exit), they don't just vanish.
