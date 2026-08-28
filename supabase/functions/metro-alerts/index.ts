// WMATA service incidents, summarized for the Tonight page's Metro notes.
//
// Still deliberately callable without a session: a signed-out visitor reading
// the Tonight page is the point, and F9's lesson was that the fix for an open
// proxy is to remove the abuse primitives, not to demand an account.
//
// What changed (2026-08-28). The in-module cache below is per isolate, so it
// bounded nothing across a burst — a flood spawns isolates and each one goes
// upstream on its first request. The cache is now shared through the database,
// and an hourly ceiling backs it up, so the worst case is stale incidents
// rather than a burnt WMATA key.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CACHE_MS = 5 * 60 * 1000;
const MAX_CALLS_PER_HOUR = 40; // one every 90s is far more than a 5-minute cache needs

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cached } = await supa.from("api_cache")
    .select("body, fetched_at").eq("name", "wmata").eq("key", "incidents").maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return json(cached.body);

  const { data: mayCall } = await supa.rpc("take_api_credit", { p_name: "wmata", p_max: MAX_CALLS_PER_HOUR });
  if (!mayCall) return json(cached?.body ?? { alerts: [] });

  try {
    const r = await fetch("https://api.wmata.com/Incidents.svc/json/Incidents", {
      headers: { api_key: Deno.env.get("WMATA_KEY")! },
    });
    if (!r.ok) return json(cached?.body ?? { alerts: [] });
    const d = await r.json();
    const body = {
      alerts: (d.Incidents || []).slice(0, 6).map((i: Record<string, string>) => ({
        lines: (i.LinesAffected || "").split(/;\s*/).map((s: string) => s.trim().toLowerCase()).filter(Boolean),
        desc: i.Description,
      })),
    };
    await supa.from("api_cache").upsert({ name: "wmata", key: "incidents", body, fetched_at: new Date().toISOString() });
    await supa.from("api_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    return json(body);
  } catch {
    return json(cached?.body ?? { alerts: [] });
  }
});
