// Prove you go there.
//
// The client cannot write school_verifications — it has no policy to do so.
// It asks this function, which owns the whole exchange: it decides whether an
// address counts, mints the code, and records the result.
//
// Two ways in:
//   1. The account's own sign-in address is already a school address that
//      Supabase confirmed. Nothing to send — the proof already happened.
//   2. Anything else gets a six-digit code by email, good for 15 minutes.
//
// The address is never stored, only a SHA-256 of it: we need to answer "has
// this mailbox already verified someone?" and nothing else.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_DAY = 5;
const RESEND_GAP_MS = 60_000;
const VERIFICATION_YEARS = 1;

const sha = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
// six digits, from the CSPRNG, no modulo bias worth arguing about
const mintCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

const normalise = (email: string) => email.trim().toLowerCase();
const domainOf = (email: string) => normalise(email).split("@")[1] ?? "";

// student.gwu.edu and gwu.edu are the same school; evilgwu.edu is not
const matchSchool = (email: string, schools: { domain: string; name: string }[]) => {
  const d = domainOf(email);
  return schools.find((s) => d === s.domain || d.endsWith("." + s.domain)) ?? null;
};

const sendCode = async (to: string, code: string, school: string) => {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("VERIFY_FROM") ?? "out. <onboarding@resend.dev>";
  if (!key) return { ok: false, reason: "no-mailer" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `${code} — your out. school code`,
      text: [
        `Your code is ${code}.`,
        ``,
        `It confirms you're at ${school} so you can see campus-only posts.`,
        `Good for ${CODE_TTL_MIN} minutes. If you didn't ask for this, ignore it —`,
        `nothing happens to your account.`,
      ].join("\n"),
    }),
  }).catch(() => null);
  if (!r?.ok) return { ok: false, reason: "send-failed" };
  return { ok: true };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "sign in first" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, email, code } = await req.json().catch(() => ({}));
  const { data: schools } = await admin.from("schools").select("domain, name").order("sort");
  const list = schools ?? [];

  // ------------------------------------------------------------- start ----
  if (action === "start") {
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
      return json({ error: "That doesn't look like an email address." }, 400);
    }
    const school = matchSchool(email, list);
    if (!school) return json({ error: "That's not a school we cover yet." }, 400);

    const addr = normalise(email);
    const emailHash = await sha(addr);

    // one mailbox verifies one account
    const { data: taken } = await admin.from("school_verifications")
      .select("user_id").eq("email_hash", emailHash).maybeSingle();
    if (taken && taken.user_id !== user.id) {
      return json({ error: "That address has already verified another account." }, 409);
    }

    // Path 1: they signed in with this very address and Supabase confirmed it.
    // Asking them to prove control of a mailbox they just authenticated with
    // would be theatre.
    if (normalise(user.email ?? "") === addr && user.email_confirmed_at) {
      const { error } = await admin.from("school_verifications").upsert({
        user_id: user.id,
        domain: school.domain,
        email_hash: emailHash,
        verified_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + VERIFICATION_YEARS * 365 * 864e5).toISOString(),
      });
      if (error) return json({ error: "Couldn't record that. Try again." }, 500);
      await admin.from("school_challenges").delete().eq("user_id", user.id);
      return json({ status: "verified", school: school.name, domain: school.domain, instant: true });
    }

    // Path 2: mint a code and mail it
    const { data: prior } = await admin.from("school_challenges")
      .select("sent_at, sends_today, day").eq("user_id", user.id).maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    let sendsToday = 1;
    if (prior) {
      if (Date.now() - Date.parse(prior.sent_at) < RESEND_GAP_MS) {
        return json({ error: "Give it a minute before asking for another code." }, 429);
      }
      if (prior.day === today) {
        if (prior.sends_today >= MAX_SENDS_PER_DAY) {
          return json({ error: "That's enough codes for one day. Try tomorrow." }, 429);
        }
        sendsToday = prior.sends_today + 1;
      }
    }

    const plain = mintCode();
    // salted with the user id, so a stolen table of hashes is not a rainbow
    // table of six-digit numbers
    const codeHash = await sha(`${user.id}:${plain}`);
    const sent = await sendCode(addr, plain, school.name);
    if (!sent.ok) {
      return json({
        error: sent.reason === "no-mailer"
          ? "Email codes aren't switched on yet. Sign in with your school address instead."
          : "That code wouldn't send. Try again in a moment.",
        reason: sent.reason,
      }, 503);
    }

    const { error } = await admin.from("school_challenges").upsert({
      user_id: user.id,
      domain: school.domain,
      email_hash: emailHash,
      code_hash: codeHash,
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
      attempts: 0,
      sends_today: sendsToday,
      day: today,
    });
    if (error) return json({ error: "Couldn't start that. Try again." }, 500);
    return json({ status: "sent", school: school.name, domain: school.domain, expiresInMin: CODE_TTL_MIN });
  }

  // ----------------------------------------------------------- confirm ----
  if (action === "confirm") {
    const digits = String(code ?? "").replace(/\D/g, "");
    const { data: ch } = await admin.from("school_challenges")
      .select("*").eq("user_id", user.id).maybeSingle();
    if (!ch) return json({ error: "Ask for a code first." }, 400);
    if (Date.parse(ch.expires_at) < Date.now()) {
      await admin.from("school_challenges").delete().eq("user_id", user.id);
      return json({ error: "That code expired. Ask for a new one." }, 400);
    }
    if (ch.attempts >= MAX_ATTEMPTS) {
      await admin.from("school_challenges").delete().eq("user_id", user.id);
      return json({ error: "Too many tries. Ask for a new code." }, 429);
    }
    if (await sha(`${user.id}:${digits}`) !== ch.code_hash) {
      await admin.from("school_challenges")
        .update({ attempts: ch.attempts + 1 }).eq("user_id", user.id);
      return json({ error: "That code doesn't match.", left: MAX_ATTEMPTS - ch.attempts - 1 }, 400);
    }

    const { error } = await admin.from("school_verifications").upsert({
      user_id: user.id,
      domain: ch.domain,
      email_hash: ch.email_hash,
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + VERIFICATION_YEARS * 365 * 864e5).toISOString(),
    });
    if (error) return json({ error: "Couldn't record that. Try again." }, 500);
    await admin.from("school_challenges").delete().eq("user_id", user.id);
    const school = list.find((s) => s.domain === ch.domain);
    return json({ status: "verified", school: school?.name ?? ch.domain, domain: ch.domain });
  }

  return json({ error: "unknown action" }, 400);
});
