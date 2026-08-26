// Stop-by-stop timeline for one live train, from WMATA's GTFS-RT TripUpdates.
import GtfsRt from "npm:gtfs-realtime-bindings@2.2.0";
import stations from "./stations.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

const ROUTE = { RD: "RED", OR: "ORANGE", SV: "SILVER", BL: "BLUE", GR: "GREEN", YL: "YELLOW" } as const;
const codeOf = (stopId: string) => (stopId.match(/^PF_([A-Z]\d\d)_/) || [])[1];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { code, line, dest, min } = await req.json();
  const routeId = ROUTE[line as keyof typeof ROUTE];
  if (!code || !routeId) return json({ error: "bad params" });
  const codes = String(code).split(",");
  const targetTime = Date.now() / 1000 + (Number(min) || 0) * 60;

  const key = Deno.env.get("WMATA_KEY")!;
  const [pb, incidents] = await Promise.all([
    fetch("https://api.wmata.com/gtfs/rail-gtfsrt-tripupdates.pb", { headers: { api_key: key } })
      .then((r) => r.arrayBuffer()),
    fetch("https://api.wmata.com/Incidents.svc/json/Incidents", { headers: { api_key: key } })
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
  if (!best) return json({ error: "train not found" });

  const alerts = (incidents.Incidents ?? [])
    .filter((i: { LinesAffected?: string }) => (i.LinesAffected ?? "").includes(line))
    .map((i: { Description?: string }) => i.Description)
    .slice(0, 2);
  return json({
    stops: best.stops.map((s) => ({
      code: s.code,
      name: stations[s.code]?.name ?? s.code,
      lines: stations[s.code]?.lines ?? [],
      time: s.time,
    })),
    alerts,
  });
});
