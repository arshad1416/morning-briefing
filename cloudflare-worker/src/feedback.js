/**
 * Feedback route — extracted verbatim from the original single-file Worker.
 * Exports handleFeedback(request, env) → Response. Behavior preserved
 * byte-for-byte: same validation, same env vars (TELEGRAM_BOT_TOKEN /
 * TELEGRAM_HOME_CHANNEL), same optional FEEDBACK KV inbox, same Telegram POST,
 * same CORS/json helper.
 *
 * -- Feedback (site feedback bubble) --
 * Additive route; forwards to Telegram. Optional durable inbox if a KV
 * namespace named FEEDBACK is bound (no-op when unbound).
 */
import { getOrigin } from './util.js';

const json = (d, s = 200, request = null) => {
  const origin = request ? getOrigin(request) : 'https://briefing.arshadkazi.ca';
  return new Response(JSON.stringify(d), {
    status: s,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
    },
  });
};

export async function handleFeedback(request, env) {
  let fb;
  try { fb = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, request); }
  const type = ["feature", "bug", "general"].includes(fb?.type) ? fb.type : "general";
  const message = String(fb?.message || "").trim().slice(0, 2000);
  const email = fb?.email ? String(fb.email).trim().slice(0, 200) : "";
  const page = String(fb?.page || "").slice(0, 80);
  if (message.length < 3) return json({ error: "message_too_short" }, 400, request);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400, request);

  const token = env?.TELEGRAM_BOT_TOKEN;
  const chatId = env?.TELEGRAM_HOME_CHANNEL;
  if (!token || !chatId) return json({ error: "sink_unconfigured" }, 500, request);

  const icon = type === "bug" ? "\u{1F41E}" : type === "feature" ? "✨" : "\u{1F4AC}";
  const ip = request.headers.get("CF-Connecting-IP") || "?";
  const text = `${icon} MapleGamma feedback (${type})\n\n${message}\n\n— page: ${page || "#/"}\n— email: ${email || "(none)"}\n— ip: ${ip}`;

  try {
    if (env?.FEEDBACK) {
      await env.FEEDBACK.put(`fb:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        JSON.stringify({ type, message, email, page, ip, ts: Date.now() }));
    }
  } catch (e) {}

  // Durable store for the AgenticOS dashboard + the Pi feedback→kanban cron, in
  // addition to the Telegram ping. Best-effort — never fail the request on a DB
  // hiccup. Rows start status='new'; the cron cards bug/feature, logs general.
  try {
    if (env?.DB) {
      await env.DB.prepare(
        "INSERT INTO feedback (id, type, message, email, page, ip, created_at, status) VALUES (?,?,?,?,?,?,?, 'new')"
      ).bind(crypto.randomUUID(), type, message, email || null, page || null, ip, Date.now()).run();
    }
  } catch (e) {}

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!tg.ok) return json({ error: "delivery_failed" }, 502, request);
  } catch (e) {
    return json({ error: "delivery_failed" }, 502, request);
  }
  return json({ ok: true }, 200, request);
}
