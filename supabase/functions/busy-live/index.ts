// Proxy for BestTime's live endpoint: holds the private key server-side,
// caches per spot for 20 minutes in live_cache so credits don't burn.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { spot_id, venue_name, venue_address } = await req.json();
  if (!spot_id || !venue_name || !venue_address) return json({ error: "missing params" });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: cached } = await supa.from("live_cache").select("*").eq("spot_id", spot_id).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < 20 * 60 * 1000) return json(cached);

  const params = new URLSearchParams({
    api_key_private: Deno.env.get("BESTTIME_KEY")!,
    venue_name,
    venue_address,
  });
  const r = await fetch("https://besttime.app/api/v1/forecasts/live", { method: "POST", body: params });
  const d = await r.json();
  if (d.status !== "OK") return json(cached ?? { error: d.message ?? "unavailable" });

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
