// WMATA service incidents, summarized for the Tonight page's Metro notes.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

let cache: { at: number; body: string } | null = null

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) {
    return new Response(cache.body, { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
  try {
    const key = Deno.env.get('WMATA_KEY')
    const r = await fetch('https://api.wmata.com/Incidents.svc/json/Incidents', { headers: { api_key: key! } })
    const d = await r.json()
    const alerts = (d.Incidents || []).slice(0, 6).map((i: Record<string, string>) => ({
      lines: (i.LinesAffected || '').split(/;\s*/).map((s: string) => s.trim().toLowerCase()).filter(Boolean),
      desc: i.Description,
    }))
    const body = JSON.stringify({ alerts })
    cache = { at: Date.now(), body }
    return new Response(body, { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ alerts: [] }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
