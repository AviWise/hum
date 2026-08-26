// Real place details from OpenStreetMap via Overpass: opening hours, website,
// phone, cuisine — free, legal on any map, cached 7 days.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { name, lat, lng } = await req.json();
  if (!name || !lat || !lng) return json({ error: "missing params" });
  const key = `${name}|${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`.slice(0, 200);

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cached } = await supa.from("place_cache").select("*").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < 7 * 864e5) return json(cached.data);

  const safe = String(name).replace(/[\\"'()\[\]{}|.*+?^$]/g, " ").trim().slice(0, 60);
  const q = `[out:json][timeout:15];nw(around:150,${Number(lat)},${Number(lng)})["name"~"${safe}",i];out tags center 6;`;
  let r: Response | null = null;
  for (const ep of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    r = await fetch(ep, {
      method: "POST",
      body: "data=" + encodeURIComponent(q),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "out-dc-prototype/0.1 (student project; contact aviwise2@gmail.com)",
      },
    }).catch(() => null);
    if (r?.ok) break;
  }
  if (!r?.ok) return json(cached?.data ?? { error: "overpass " + (r?.status ?? "down") });
  const d = await r.json();
  const el = (d.elements ?? []).sort((a: { tags?: Record<string, string> }, b: { tags?: Record<string, string> }) =>
    Object.keys(b.tags ?? {}).length - Object.keys(a.tags ?? {}).length)[0];
  const t = el?.tags ?? {};
  const data = {
    hours: t.opening_hours ?? null,
    website: t.website ?? t["contact:website"] ?? null,
    phone: t.phone ?? t["contact:phone"] ?? null,
    cuisine: t.cuisine?.replace(/[;_]/g, " · ") ?? null,
    outdoor: t.outdoor_seating === "yes",
    wheelchair: t.wheelchair === "yes",
  };
  await supa.from("place_cache").upsert({ key, data, fetched_at: new Date().toISOString() });
  return json(data);
});
