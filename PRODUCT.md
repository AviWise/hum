# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + Vite. The map is MapLibre GL JS over OpenFreeMap vector tiles (free, no API key; attribution required and shown) — the founder asked for a full real map "like Apple Maps" on 2026-08-25, replacing the earlier hand-drawn SVG basemap. The provider's style is recolored at runtime (`warmify()` in CityMap.jsx) into the brand palette so the real map stays inside the pinned world; busyness is a MapLibre heatmap layer; spots are HTML markers. No backend in v1 — mock data modules shaped like the future API; clean upgrade path to accounts/posting (Supabase or similar later).

## Users

Primary: college students and young people (~18–25) in and around Washington, D.C., deciding where to go tonight or this weekend — on their phones, often mid-plan with friends. Not gated to any one campus; the city is the community.

## Product Purpose

A live map of D.C. that answers "where is it worth going right now?" Spots appear as bubbles on the map; students post events and photos that expire after a set time; aggregate activity renders as a busyness/"hotspot" overlay so you can see at a glance which neighborhoods are alive tonight. Success = a student opens it on a Friday at 9pm and finds somewhere to go within a minute.

## Positioning

Unlike Yelp/Google Maps (static reviews, all ages, no time dimension) or Instagram (social graph, no map), this is a *time-decaying city map for young people*: everything on it is happening now or soon, and stale content deletes itself. The expiry mechanic is the product — the map is never out of date because nothing on it is allowed to get old.

## Operating Context

- Used overwhelmingly on phones, often outdoors/at night, one-handed, on cellular. Mobile is the primary viewport; desktop is secondary.
- Peak usage: Thursday–Saturday evenings; secondary daytime use for study spots, coffee, cheap eats.
- Geography: the D.C. core — Georgetown, Foggy Bottom, Dupont, Adams Morgan, U Street, Shaw, H Street, Navy Yard, National Mall, Columbia Heights, Tenleytown/AU, Brookland.

## Capabilities and Constraints

- v1 (this build): map with spot bubbles, spot detail sheets, expiring event posts with photos, busyness/hotspot overlay, category filtering, a "tonight" feed. All data is realistic mock data shaped like the future API; no auth, no real posting yet.
- Content model (confirmed): crowdsourced — the founder seeds the spot list; users post events/photos that expire; busyness derives from post/check-in activity. v1 simulates this.
- Undecided: product name (working name only), real busyness data source (own activity vs. an API like BestTime), moderation approach, monetization.

## Brand Commitments

Aesthetic pinned by the founder (2026-08-25): model the look on **Hinge** (warm off-white ground, editorial serif display over a clean grotesque, rounded photo-forward cards, deep plum accent, calm premium feel) with an **Alo** vibe (wellness-luxury minimalism: bone/sand palette, tracked uppercase micro-labels, generous whitespace, muted earth tones, soft diffuse shadows). Execute this world at those two brands' craft level; do not re-roll visual directions without the founder asking. Working product name: "out." (lowercase serif wordmark with period) — placeholder, not confirmed.

## Evidence on Hand

None yet — no real venues under contract, no user posts, no testimonials. Do not fabricate reviews, partner logos, or user counts. Mock content must be plausible real D.C. places and clearly demo data where a claim would otherwise be implied.

## Product Principles

1. **Now beats best.** Rank and render by what is live/soon, not by all-time rating.
2. **The map is the app.** Every feature must earn its place on or over the map; no buried menu-world.
3. **Expiry is a feature.** Content aging out keeps trust; never show stale events as current.
4. **One-minute answer.** A first-time user finds somewhere to go tonight in under a minute, no account required to browse.
5. **City, not campus.** No school gating; the shared map is the network effect.

## Accessibility & Inclusion

Night-time outdoor phone use on a light (bone) UI: text and controls hold WCAG AA contrast against the warm cream ground and tinted surfaces, including at low screen brightness outdoors; touch targets sized for one-handed use; map information keeps a non-color-only channel (always-visible labels, crowd words like "Packed", counts — never heat color alone).
