// door-photo: "Snap your door" first look for the website service request (Bluegrass Commercial Door & More). Always $0.
// POST { image: "<base64 jpeg/png/webp, <= ~700 KB>", mime, note?, sessionId } -> { look: {...}, source } | { fallback: true, reason }
// The photo is sent to the Gemini free tier once for this answer and is never stored here. Only the visitor's note (masked) is logged.
// Same guardrails as `chat`: one origin, visitor limits + shared Gemini budget through the chat_* SQL functions (role chat_fn,
// secret CHAT_DB_URL), no Supabase service key, no table access, public facts only, no prices / lead times / promises.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.5";

const ALLOWED_ORIGINS = new Set(["https://rccoleman19.github.io"]);
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
const MAX_BODY_BYTES = 1_000_000;
const LIMITS = { ip_10min: 4, ip_day: 12, session_10min: 4 }; // stricter than chat: photos cost more tokens
const MODEL = "gemini-3.1-flash-lite";
const PHONE = "270-780-3235";
const env = (k: string) => (Deno.env.get(k) || "").trim();
const DB_URL = env("CHAT_DB_URL");
const sql = DB_URL ? postgres(DB_URL, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 4, ssl: "require" }) : null;

const PARTS = ["closer", "hinges", "lockset", "panic", "strike", "frame", "door_slab", "glass", "weatherstrip", "threshold", "track", "access_control", "unknown"];
const PROMPT = `You look at ONE photo a visitor took of a door that has a problem, for Bluegrass Commercial Door & More (Bowling Green, KY; phone ${PHONE}), a door, frame and hardware company.
Give a careful FIRST LOOK so the office knows what the visit is about. You are not a technician and you cannot see inside the hardware.
Rules: no prices, costs, time estimates, lead times, warranties, brand claims or promises. Do not name people. If the photo is not a door, gate, frame, door hardware or flagpole, set is_door=false.
If anything looks unsafe (door could fall, glass broken, a fire or exit door that will not close or open, cannot lock up the building) set urgent=true.
Keep every text short, plain, friendly, and hedged ("looks like", "may be").`;
const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_door: { type: "BOOLEAN" },
    door_kind: { type: "STRING", description: "e.g. aluminum storefront, hollow metal steel, wood interior, all-glass, barn door" },
    seen: { type: "STRING", description: "one sentence: what is visible in the photo" },
    likely_issue: { type: "STRING", description: "one or two sentences, hedged" },
    parts: { type: "ARRAY", items: { type: "STRING", enum: PARTS } },
    urgent: { type: "BOOLEAN" },
    ask_next: { type: "STRING", description: "one question the office would want answered, e.g. does it still latch" },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["is_door", "seen", "likely_issue", "parts", "urgent", "confidence"],
};

const originOk = (o: string) => ALLOWED_ORIGINS.has(o) || LOCAL_ORIGIN.test(o);
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && originOk(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}
const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/https?:\/\/\S+/g, "").replace(/\$\s?\d[\d,.]*/g, "").replace(/\s{2,}/g, " ").trim().slice(0, n);
const mask = (s: string) => s.replace(/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g, "[email]").replace(/(?:\d[\s().-]*){7,}\d/g, "[number]");
async function q<T>(run: (s: NonNullable<typeof sql>) => Promise<T>): Promise<T | null> {
  if (!sql) return null;
  try { return await run(sql); } catch (e) { console.error("db", (e as Error).message); return null; }
}
async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("CHAT_IP_SALT") || DB_URL || "chat-ip"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("chat-ip:" + ip)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return origin && originOk(origin) ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
  if (!origin || !originOk(origin)) return json(403, { error: "origin_not_allowed" }, null);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" }, origin);
  let b: any; try { b = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }, origin); }
  const sid = typeof b?.sessionId === "string" && /^[A-Za-z0-9_-]{8,48}$/.test(b.sessionId) ? b.sessionId : "";
  const mime = ["image/jpeg", "image/png", "image/webp"].includes(b?.mime) ? b.mime : "";
  const image = typeof b?.image === "string" && /^[A-Za-z0-9+/=]{2000,}$/.test(b.image) ? b.image : "";
  if (!sid || !mime || !image) return json(400, { error: "bad_request" }, origin);
  const note = clean(b?.note, 300);
  const key = env("GEMINI_API_KEY");
  if (!sql || !key) return json(200, { fallback: true, reason: "not_configured" }, origin);

  const ip = await ipHash(req);
  const verdict = await q(async (s) => (await s`select public.chat_rate_take(${ip}, ${"photo-" + sid}, ${s.json(LIMITS)}::jsonb) as r`)[0]?.r as string);
  if (verdict === "ip" || verdict === "session") return json(200, { fallback: true, reason: "limited" }, origin);
  const budget = await q(async (s) => (await s`select public.chat_quota_take('gemini', 12, 400, 'America/Los_Angeles') as r`)[0]?.r as boolean);
  if (budget !== true) return json(200, { fallback: true, reason: "busy" }, origin);

  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
  let look: any = null, reason = "";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: image } }, { text: note ? `Visitor's note: ${note}` : "No note." }] }],
        generationConfig: { maxOutputTokens: 500, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: "minimal" } },
      }),
    });
    if (!r.ok) { reason = `http-${r.status}`; console.error("gemini", r.status, (await r.text()).slice(0, 300)); }
    else {
      const d = await r.json();
      const text = (d?.candidates?.[0]?.content?.parts || []).filter((x: any) => !x.thought && typeof x.text === "string").map((x: any) => x.text).join("");
      try { look = JSON.parse(text); } catch { reason = "parse"; }
    }
  } catch (e) { reason = (e as Error).name === "AbortError" ? "timeout" : "network"; }
  finally { clearTimeout(timer); }

  const out = look ? {
    is_door: look.is_door !== false,
    door_kind: clean(look.door_kind, 80),
    seen: clean(look.seen, 220),
    likely_issue: clean(look.likely_issue, 320),
    parts: (Array.isArray(look.parts) ? look.parts : []).filter((p: string) => PARTS.includes(p)).slice(0, 4),
    urgent: look.urgent === true,
    ask_next: clean(look.ask_next, 160),
    confidence: ["low", "medium", "high"].includes(look.confidence) ? look.confidence : "low",
  } : null;
  const logIt = q((s) => s`select public.chat_log_write(${sid}, ${ip}, ${"[photo] " + mask(note)}, ${out ? mask(out.likely_issue) : null}, ${!out}, ${"gemini:" + MODEL}, ${out ? "photo-ok" : "photo-" + reason})`);
  try { (globalThis as any).EdgeRuntime?.waitUntil?.(logIt); } catch { /* ignore */ }
  if (!out) return json(200, { fallback: true, reason: reason || "unavailable" }, origin);
  return json(200, { look: out, source: "gemini" }, origin);
});
