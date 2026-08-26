// Licensed venue details from Foursquare Places: rating, price, real photos.
// Key stays server-side; responses cached 7 days per venue.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
const FSQ = {
  Authorization: `Bearer ${Deno.env.get("FSQ_KEY")}`,
  "X-Places-Api-Version": "2025-06-17",
  Accept: "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { name, lat, lng } = await req.json();
  if (!name || !lat || !lng) return json({ error: "missing params" });
  const key = `fsq|${name}|${Number(lat).toFixed(3)}`.slice(0, 200);

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cached } = await supa.from("place_cache").select("*").eq("key", key).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < 7 * 864e5) return json(cached.data);

  const search = await fetch(
    `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(name)}&ll=${lat},${lng}&radius=300&limit=1&fields=fsq_place_id,name,rating,price,website,tel,hours,photos`,
    { headers: FSQ },
  );
  if (!search.ok) return json(cached?.data ?? { error: "fsq " + search.status, detail: (await search.text()).slice(0, 200) });
  const d = await search.json();
  const p = d.results?.[0];
  if (!p) return json({ none: true });
  const data = {
    fsqName: p.name,
    rating: p.rating ?? null,          // out of 10
    price: p.price ?? null,            // 1-4
    website: p.website ?? null,
    tel: p.tel ?? null,
    hoursDisplay: p.hours?.display ?? null,
    openNow: p.hours?.open_now ?? null,
    photos: (p.photos ?? []).slice(0, 6).map((ph: { prefix: string; suffix: string }) => ph.prefix + "600x400" + ph.suffix),
  };
  await supa.from("place_cache").upsert({ key, data, fetched_at: new Date().toISOString() });
  return json(data);
});
