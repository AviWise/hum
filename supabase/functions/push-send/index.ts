// The sender. Runs on a schedule, decides whether anything is worth saying,
// and says at most one thing.
//
// The restraint is the product. A going-out app that buzzes at 3am about a bar
// gets deleted by Tuesday, so: nothing outside 10:00–22:30 local, at most one
// a day per person, and never the same thing twice (push_log is the ledger).
// The only notification worth sending answers the question the app answers —
// something is on near you, now.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};
const cat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};
const te = (s: string) => new TextEncoder().encode(s);

// VAPID: a signed JWT saying who we are, so the push service accepts us
async function vapidHeader(endpoint: string) {
  const aud = new URL(endpoint).origin;
  const pub = Deno.env.get("VAPID_PUBLIC")!;
  const prv = Deno.env.get("VAPID_PRIVATE")!;
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:aviwise2@gmail.com";
  const raw = fromB64url(pub);

  const key = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256",
    x: b64url(raw.slice(1, 33)),
    y: b64url(raw.slice(33, 65)),
    d: prv,
    ext: true,
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const header = b64url(te(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(te(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject,
  })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te(`${header}.${body}`));
  return { Authorization: `vapid t=${header}.${body}.${b64url(sig)}, k=${pub}` };
}

// aes128gcm per RFC 8291 — the push service carries it without reading it
async function encrypt(payload: string, p256dh: string, authSecret: string) {
  const clientPub = fromB64url(p256dh);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const clientKey = await crypto.subtle.importKey("raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, local.privateKey, 256));

  const hkdf = async (salt2: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) => {
    const k = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt2, info }, k, len * 8));
  };

  const prk = await hkdf(fromB64url(authSecret), shared, cat(te("WebPush: info\0"), clientPub, localPubRaw), 32);
  const cek = await hkdf(salt, prk, te("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, te("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plain = cat(te(payload), new Uint8Array([2]));   // padding delimiter
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return cat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw, ct);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // cron-only: nothing a client gets to trigger
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) {
    return json({ error: "no" }, 401);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { dryRun, only, force } = await req.json().catch(() => ({}));

  // the whole audience is in one timezone, so quiet hours is one comparison
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = local.getHours() + local.getMinutes() / 60;
  if (!force && (hour < 10 || hour > 22.5)) return json({ sent: 0, skipped: "quiet hours" });

  const today = local.toISOString().slice(0, 10);
  const { data: subs } = await admin.from("push_subs")
    .select("id, user_id, endpoint, p256dh, auth, sent_today, day")
    .is("failed_at", null).limit(500);
  const targets = (subs ?? []).filter((s) => (only ? s.user_id === only : true))
    .filter((s) => s.day !== today || s.sent_today < 1);

  // No posts, no push. There is no version of "nothing is happening" worth a buzz.
  const { count } = await admin.from("posts")
    .select("id", { count: "exact", head: true })
    .gt("expires_at", new Date().toISOString())
    .is("removed_at", null)
    .eq("audience", "city");
  const live = count ?? 0;
  if (live < 3 && !force) return json({ sent: 0, skipped: `only ${live} live` });

  const key = `live-${today}-${Math.floor(hour)}`;
  const payload = JSON.stringify({
    title: "hum.",
    body: live === 1 ? "Somewhere is live in D.C. right now" : `${live} places are live in D.C. right now`,
    url: "/hum/#/tonight",
    tag: "out-live",
  });
  if (dryRun) return json({ wouldSend: targets.length, live, key, hour: +hour.toFixed(2) });

  let sent = 0, gone = 0;
  for (const s of targets) {
    // the ledger is the dedupe: a unique key means nobody hears this twice
    const { error: dupe } = await admin.from("push_log").insert({ user_id: s.user_id, kind: "live", key });
    if (dupe) continue;
    try {
      const res = await fetch(s.endpoint, {
        method: "POST",
        headers: {
          ...(await vapidHeader(s.endpoint)),
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: "1800",
        },
        body: await encrypt(payload, s.p256dh, s.auth),
      });
      if (res.status === 404 || res.status === 410) {
        await admin.from("push_subs").update({ failed_at: new Date().toISOString() }).eq("id", s.id);
        gone++;
        continue;
      }
      if (res.ok) {
        sent++;
        await admin.from("push_subs").update({
          last_sent_at: new Date().toISOString(),
          sent_today: s.day === today ? s.sent_today + 1 : 1,
          day: today,
        }).eq("id", s.id);
      }
    } catch { /* one bad endpoint does not stop the round */ }
  }
  return json({ sent, gone, live });
});
