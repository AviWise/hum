// Real-time WMATA rail predictions, proxied so the API key stays server-side.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { codes } = await req.json();
  if (!codes || !/^[A-Z0-9,]{2,24}$/.test(codes)) return json({ error: "bad codes" });
  const r = await fetch(
    `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${codes}`,
    { headers: { api_key: Deno.env.get("WMATA_KEY")! } },
  );
  if (!r.ok) return json({ error: "wmata " + r.status });
  const d = await r.json();
  const trains = (d.Trains ?? [])
    .filter((t: Record<string, string>) => t.Line && t.Line !== "--" && t.Min)
    .slice(0, 8)
    .map((t: Record<string, string>) => ({
      line: t.Line,
      dest: t.DestinationName || t.Destination,
      min: t.Min,
    }));
  return json({ trains });
});
