# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + Vite. The map is MapLibre GL JS over OpenFreeMap vector tiles (free, no API key; attribution required and shown) — the founder asked for a full real map "like Apple Maps" on 2026-08-25, replacing the earlier hand-drawn SVG basemap. The provider's style is recolored at runtime (`warmify()` in CityMap.jsx) into the brand palette so the real map stays inside the pinned world; busyness is a MapLibre heatmap layer; spots are HTML markers. Supabase carries auth, posts, storage and row-level security (the publishable key is safe because RLS holds the permissions — see supabase/migrations and scripts/rls-attack.mjs, which proves it).

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

- Shipped: map with spot bubbles, spot sheets, real accounts, real expiring posts with photos (stored at 96/480/1280px, EXIF stripped), busyness/hotspot overlay, category filtering, Tonight and Feed pages, reporting and moderation.
- Seeded demo content still fills the quiet hours. Every seeded post carries a DEMO tag and every seeded author is `@out.demo.*`; `posts.is_demo` marks any that ever live in the database. Real posts must never sit beside untagged fake ones.
- Content model (confirmed): crowdsourced — the founder seeds the spot list; users post events/photos that expire; busyness derives from post/check-in activity. v1 simulates this.
- Undecided: product name (working name only), monetization.

## Brand Commitments

Aesthetic pinned by the founder (2026-08-25): model the look on **Hinge** (warm off-white ground, editorial serif display over a clean grotesque, rounded photo-forward cards, deep plum accent, calm premium feel) with an **Alo** vibe (wellness-luxury minimalism: bone/sand palette, tracked uppercase micro-labels, generous whitespace, muted earth tones, soft diffuse shadows). Execute this world at those two brands' craft level; do not re-roll visual directions without the founder asking. Working product name: "out." (lowercase serif wordmark with period) — placeholder, not confirmed.

## Evidence on Hand

None yet — no real venues under contract, no user posts, no testimonials. Do not fabricate reviews, partner logos, or user counts. Mock content must be plausible real D.C. places and clearly demo data where a claim would otherwise be implied.

## Product Principles

1. **Now beats best.** Rank and render by what is live/soon, not by all-time rating.
2. **The map is the app.** Every feature must earn its place on or over the map; no buried menu-world.
3. **Expiry is a feature.** Content aging out keeps trust; never show stale events as current.
4. **One-minute answer.** A first-time user finds somewhere to go tonight in under a minute, no account required to browse. Posting needs an account; sign in with any provider. Verifying a `.edu` address afterward unlocks your school's page — it is never a wall in front of the map. Non-students get the city and simply have no school page.
5. **Campus is the launch unit; the city is the map.** One shared pool of content that everyone contributes to and everyone sees. School is an identity and filter layer on top of that pool — never a separate map, never a separate feed of its own content. You launch a campus at a time because that is how a night actually fills up, but what fills is the city.

## Accessibility & Inclusion

Night-time outdoor phone use on a light (bone) UI: text and controls hold WCAG AA contrast against the warm cream ground and tinted surfaces, including at low screen brightness outdoors; touch targets sized for one-handed use; map information keeps a non-color-only channel (always-visible labels, crowd words like "Packed", counts — never heat color alone).

## Contests

**Designed, not built — gated.** Photos posted at a spot compete over a window;
the winner takes a crown that survives the photo's expiry. The data model is
live from the first post (`contests`, `trophies`, `impressions`, `likes.surface`)
because impressions and contest windows cannot be reconstructed later — miss
them and the first month of scores is permanently unfair. Scoring is
`likes / impressions`, never raw likes, so a photo posted at 2am is not punished
for the hour. A spot-week produces two contest rows, city and school, because
the two crowns are decided by different audiences. None of the surface — crowns,
leaderboards, trophy shelves, the shuffled feed and its exposure quotas — gets
built until the retention question answers itself: **does anyone post a second
time without being asked?** A leaderboard with four photos on it advertises an
empty app. Measure with `node scripts/retention.mjs`.

## Notifications

**Designed, not yet implemented.** One notification, opt-in, never more than one
per night. It exists to answer the question the app exists to answer — *is
anything worth going to tonight?* — at the moment a person can still act on it.

**Trigger.** Thursday, Friday, Saturday at 6:00 PM local. Only for people who
explicitly opted in (asked once, after their first post — never on first open).
Skipped entirely when the top three spots are all below "steady", because a
quiet night is not worth interrupting anyone for.

**Copy.** Headline plus the top three, drawn from the same live busyness the map
shows:

> **out. — Friday, 6:00 PM**
> Big Friday building. 14th & U is buzzing, U Street steady, Navy Yard filling.

Variants follow the mood line already on the Tonight page ("A quiet Thursday" →
"Quiet so far — 9:30 has a show at 7 if you want a plan.").

**Rules.**
- One per night, maximum. No follow-ups, no re-engagement pings, no "you haven't
  opened out. in a while."
- No streaks, no counters, no manufactured scarcity.
- Nothing is held back to make the notification feel necessary: everything in it
  is already visible in the app to anyone who opens it.
- Opting out is one tap from the notification itself and from the account sheet.
- If the data is stale or the busyness read fails, send nothing.
