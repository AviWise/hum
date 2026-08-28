// Real-time WMATA rail predictions, proxied so the API key stays server-side.
//
// Still callable without a session, for the same reason as metro-alerts and
// busy-live: the next train is what a signed-out visitor came for.
//
// What changed (2026-08-28). Three abuse primitives, the same shape F9 found in
// busy-live:
//
//   1. `codes` was validated by SHAPE only — /^[A-Z0-9,]{2,24}$/ accepts
//      "ZZ,QQ,XX" and any other string in that alphabet, so the caller decided
//      what we asked WMATA about. Codes are now checked against our own
//      stations.json, which is server-side truth; an unknown code never reaches
//      WMATA.
//   2. There was NO cache at all. Every request was an upstream call.
//   3. There was no ceiling, so a loop was bounded only by WMATA's own quota —
//      and exhausting that takes the board down for real users, which is the
//      denial of service being paid for here rather than a bill.
import { createClient } from "jsr:@supabase/supabase-js@2";
import stations from "./stations.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Predictions go stale fast, so this is short on purpose: long enough to absorb
// a burst, short enough that the board is still true.
const CACHE_MS = 25 * 1000;
const MAX_CALLS_PER_HOUR = 900; // ~15/min across every visitor, well under WMATA's free tier
const MAX_CODES = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { codes } = await req.json().catch(() => ({}));
  if (typeof codes !== "string") return json({ error: "bad codes" }, 400);

  // Server-side truth about which stations exist. Unknown codes are dropped
  // rather than forwarded, and the list is sorted and de-duplicated so that
  // "A01,B02" and "B02,A01" are one cache entry and not two.
  const known = [...new Set(codes.split(",").map((c) => c.trim().toUpperCase()))]
    .filter((c) => Object.prototype.hasOwnProperty.call(stations, c))
    .sort()
    .slice(0, MAX_CODES);
  if (!known.length) return json({ error: "unknown station" }, 404);

  const key = known.join(",");
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cached } = await supa.from("api_cache")
    .select("body, fetched_at").eq("name", "wmata").eq("key", `pred:${key}`).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return json(cached.body);

  const { data: mayCall } = await supa.rpc("take_api_credit", { p_name: "wmata", p_max: MAX_CALLS_PER_HOUR });
  if (!mayCall) return json(cached?.body ?? { trains: [] });

  const r = await fetch(
    `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${key}`,
    { headers: { api_key: Deno.env.get("WMATA_KEY")! } },
  );
  if (!r.ok) return json(cached?.body ?? { error: "wmata " + r.status });
  const d = await r.json();
  const body = {
    trains: (d.Trains ?? [])
      .filter((t: Record<string, string>) => t.Line && t.Line !== "--" && t.Min)
      .slice(0, 8)
      .map((t: Record<string, string>) => ({
        line: t.Line,
        dest: t.DestinationName || t.Destination,
        min: t.Min,
      })),
  };
  await supa.from("api_cache").upsert({ name: "wmata", key: `pred:${key}`, body, fetched_at: new Date().toISOString() });
  await supa.from("api_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  return json(body);
});
