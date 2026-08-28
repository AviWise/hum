// Proxy for BestTime's live endpoint: holds the private key server-side and
// caches per spot for 20 minutes so credits don't burn.
//
// The earlier version took venue_name and venue_address FROM THE CALLER. Two
// things followed, and the second one is the expensive one:
//
//   1. Anybody could look up any venue on earth on our BestTime account — the
//      function was a free proxy to a paid API, not a proxy to our own data.
//   2. The 20-minute cache was keyed on a caller-supplied spot_id, so any
//      request carrying a fresh string was a cache miss and therefore a paid
//      call. The cache read as protection against exactly this and was none.
//
// This endpoint is deliberately still callable without a session — signed-out
// visitors are meant to see how busy a place is, and that is the whole point
// of the map. So the fix is not authentication, which would break the product;
// it is removing the two abuse primitives. The caller may name a spot. It may
// not name a venue, and it cannot invent a cache key: an unknown spot_id never
// reaches BestTime.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CACHE_MS = 20 * 60 * 1000;
// Past this, a cached reading stops being "live" and must not be served as one.
//
// Both fallbacks below used to `return json(cached ?? …)` with no age bound, so
// once BestTime's quota ran out this function kept handing back whatever was in
// the table — for ever. On 2026-08-28 that meant Adams Morgan's sheet showed
// "live: 35% full · Quiet right now" from a reading taken 63 hours earlier, on
// the Tuesday. A number with a timestamp nobody checks is not a reading, it is
// a fossil, and the interface was calling it live.
//
// Serving nothing is the honest failure: the client already falls back to the
// weekly forecast, which is at least true about what it is.
const STALE_MS = 90 * 60 * 1000;
// A ceiling on spend that does not depend on the caller behaving. 37 venues
// refreshed every 20 minutes is ~111 paid calls an hour on its own; past this
// we serve stale numbers rather than a bill.
const MAX_CALLS_PER_HOUR = 60;

// A cached row is only worth returning while it is still plausibly true.
const fresh = (row: { fetched_at?: string } | null | undefined) =>
  row?.fetched_at && Date.now() - Date.parse(row.fetched_at) < STALE_MS ? row : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { spot_id } = await req.json().catch(() => ({}));
  if (typeof spot_id !== "string" || !spot_id) return json({ error: "missing params" }, 400);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // server-side truth about which venue this spot is, if any
  const { data: venue } = await supa.from("spot_venues")
    .select("venue_name, venue_address").eq("spot_id", spot_id).maybeSingle();
  if (!venue) return json({ error: "unknown spot" }, 404);

  const { data: cached } = await supa.from("live_cache")
    .select("*").eq("spot_id", spot_id).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return json(cached);

  // Past the hourly ceiling, stale beats expensive. A number twenty-five
  // minutes old is still a useful answer; an exhausted API key is not.
  const { data: mayCall } = await supa.rpc("take_api_credit", {
    p_name: "besttime",
    p_max: MAX_CALLS_PER_HOUR,
  });
  if (!mayCall) return json(fresh(cached) ?? { live_available: false, reason: "ceiling" });

  const params = new URLSearchParams({
    api_key_private: Deno.env.get("BESTTIME_KEY")!,
    venue_name: venue.venue_name,
    venue_address: venue.venue_address,
  });
  const r = await fetch("https://besttime.app/api/v1/forecasts/live", { method: "POST", body: params });
  const d = await r.json();
  if (d.status !== "OK") return json(fresh(cached) ?? { live_available: false, reason: d.status ?? "unavailable" });

  const row = {
    spot_id,
    live_busyness: d.analysis?.venue_live_busyness ?? null,
    forecast_busyness: d.analysis?.venue_forecasted_busyness ?? null,
    live_available: d.analysis?.venue_live_busyness_available ?? false,
    fetched_at: new Date().toISOString(),
  };
  await supa.from("live_cache").upsert(row);
  return json(row);
});
