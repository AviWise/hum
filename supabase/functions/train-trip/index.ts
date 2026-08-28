// Stop-by-stop timeline for one live train, from WMATA's GTFS-RT TripUpdates.
//
// Still callable without a session — same reasoning as busy-live (F9) and the
// other two WMATA functions: tapping a train to see where it goes is the
// product, and an account requirement would break it for the visitors it is for.
//
// What changed (2026-08-28). This was the most expensive of the three by a wide
// margin: EVERY request fetched the full GTFS-RT TripUpdates protobuf and the
// incidents feed, in parallel, with no cache and no ceiling. Two upstream calls
// per request, one of them a large binary, on our key, for anybody with the URL.
// Now: `code` and `line` are checked against server-side truth before anything
// goes upstream, answers are cached briefly and shared across isolates, the
// incidents half reuses the entry metro-alerts already keeps rather than
// fetching its own copy, and the whole thing sits behind the same hourly ceiling
// as its siblings.
import { createClient } from "jsr:@supabase/supabase-js@2";
import GtfsRt from "npm:gtfs-realtime-bindings@2.2.0";
import stations from "./stations.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CACHE_MS = 20 * 1000;
const INCIDENTS_MS = 5 * 60 * 1000;
const MAX_CALLS_PER_HOUR = 300;

const ROUTE = { RD: "RED", OR: "ORANGE", SV: "SILVER", BL: "BLUE", GR: "GREEN", YL: "YELLOW" } as const;
const codeOf = (stopId: string) => (stopId.match(/^PF_([A-Z]\d\d)_/) || [])[1];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { code, line, dest, min } = await req.json().catch(() => ({}));
  const routeId = ROUTE[line as keyof typeof ROUTE];
  if (!code || !routeId) return json({ error: "bad params" }, 400);

  // Server-side truth: an unknown station code never reaches WMATA. Sorted and
  // de-duplicated so equivalent requests share one cache entry.
  const codes = [...new Set(String(code).split(",").map((c) => c.trim().toUpperCase()))]
    .filter((c) => Object.prototype.hasOwnProperty.call(stations, c))
    .sort()
    .slice(0, 4);
  if (!codes.length) return json({ error: "unknown station" }, 404);

  const minutes = Number(min);
  const safeMin = Number.isFinite(minutes) ? Math.max(0, Math.min(120, minutes)) : 0;
  const targetTime = Date.now() / 1000 + safeMin * 60;

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Bucketed so that a sheet reopened a few seconds later is the same question.
  const destSlug = String(dest ?? "").toLowerCase().slice(0, 6).replace(/[^a-z0-9]/g, "");
  const cacheKey = `trip:${routeId}:${codes.join(",")}:${destSlug}:${Math.round(safeMin / 2) * 2}`;
  const { data: cached } = await supa.from("api_cache")
    .select("body, fetched_at").eq("name", "wmata").eq("key", cacheKey).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return json(cached.body);

  const { data: mayCall } = await supa.rpc("take_api_credit", { p_name: "wmata", p_max: MAX_CALLS_PER_HOUR });
  if (!mayCall) return json(cached?.body ?? { error: "unavailable" });

  const key = Deno.env.get("WMATA_KEY")!;

  // The incidents half reuses metro-alerts' cache entry instead of fetching a
  // second copy of the same feed; only past its TTL does it go upstream.
  const { data: inc } = await supa.from("api_cache")
    .select("body, fetched_at").eq("name", "wmata").eq("key", "incidents").maybeSingle();
  const incidentsFresh = inc && Date.now() - Date.parse(inc.fetched_at) < INCIDENTS_MS;

  const [pb, incidents] = await Promise.all([
    fetch("https://api.wmata.com/gtfs/rail-gtfsrt-tripupdates.pb", { headers: { api_key: key } })
      .then((r) => r.arrayBuffer()),
    incidentsFresh
      ? Promise.resolve({ Incidents: (inc!.body as { alerts?: { lines: string[]; desc: string }[] }).alerts?.map((a) => ({ LinesAffected: a.lines.join(";"), Description: a.desc })) ?? [] })
      : fetch("https://api.wmata.com/Incidents.svc/json/Incidents", { headers: { api_key: key } })
          .then((r) => r.json()).catch(() => ({ Incidents: [] })),
  ]);
  const feed = GtfsRt.transit_realtime.FeedMessage.decode(new Uint8Array(pb));

  let best: { score: number; stops: { code: string; time: number }[] } | null = null;
  for (const e of feed.entity) {
    const tu = e.tripUpdate;
    if (!tu || tu.trip?.routeId !== routeId) continue;
    const updates = (tu.stopTimeUpdate ?? [])
      .map((s) => ({ code: codeOf(s.stopId ?? ""), time: Number(s.arrival?.time ?? s.departure?.time ?? 0) }))
      .filter((s) => s.code && s.time);
    const here = updates.find((s) => codes.includes(s.code));
    if (!here) continue;
    const lastName = stations[updates[updates.length - 1]?.code]?.name ?? "";
    const destOk = !dest || dest === "LastTrain" || lastName.toLowerCase().includes(String(dest).toLowerCase().slice(0, 6));
    const score = Math.abs(here.time - targetTime) + (destOk ? 0 : 600);
    if (score < (best?.score ?? 300)) {
      const from = updates.indexOf(here);
      best = { score, stops: updates.slice(from) };
    }
  }
  if (!best) return json({ error: "train not found" }, 404);

  const alerts = (incidents.Incidents ?? [])
    .filter((i: { LinesAffected?: string }) => (i.LinesAffected ?? "").includes(line))
    .map((i: { Description?: string }) => i.Description)
    .slice(0, 2);
  const body = {
    stops: best.stops.map((s) => ({
      code: s.code,
      name: stations[s.code]?.name ?? s.code,
      lines: stations[s.code]?.lines ?? [],
      time: s.time,
    })),
    alerts,
  };
  await supa.from("api_cache").upsert({ name: "wmata", key: cacheKey, body, fetched_at: new Date().toISOString() });
  await supa.from("api_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  return json(body);
});
