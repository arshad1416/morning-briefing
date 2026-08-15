import { setBriefingOptIn } from './db.js';
import { clientIp, randomId } from './util.js';

// Stateless, no-login unsubscribe for the Morning Briefing email.
// Token format (must byte-match the Pi sender): t = "<user_id>.<hmacHex>"
// where hmacHex = HMAC-SHA256(BRIEFING_UNSUB_SECRET, user_id) as lowercase hex.
// user_id is a UUID (crypto.randomUUID), so it never contains "." — split on the
// last "." to recover the signature.

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Mirrors auth_password.js:12 (not exported there); same shape for both paths.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function verifyToken(env, t) {
  const dot = (t || '').lastIndexOf('.');
  if (dot <= 0 || !env.BRIEFING_UNSUB_SECRET) return null;
  const userId = t.slice(0, dot);
  const sig = t.slice(dot + 1);
  const expect = await hmacHex(env.BRIEFING_UNSUB_SECRET, userId);
  return timingSafeEqual(sig, expect) ? userId : null;
}

// `extra` lands OUTSIDE the <p> — a <form> nested in a paragraph is invalid and
// browsers silently close the <p> before it.
const PAGE = (title, heading, body, extra = '') => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — MapleGamma</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0e1a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:20px}
.card{max-width:460px;text-align:center;line-height:1.6}h1{color:#f0bf66;font-size:1.4rem;margin:0 0 12px}p{color:#cbd5e1;font-size:0.95rem}a{color:#f0bf66}
button{font:inherit;font-weight:600;background:#f0bf66;color:#0b0e1a;border:0;border-radius:10px;padding:12px 22px;cursor:pointer;margin-top:8px}</style></head>
<body><div class="card"><h1>${heading}</h1><p>${body}</p>${extra}</div></body></html>`;

// The subscribe route is a public write, so it gets the only abuse control the
// Worker has. Reuses the `chat_rate` table (migration 0005) rather than adding
// one: the chat endpoint it was built for has been deleted, so that table has
// no other reader. Two fixed-window counters share it — the per-IP one, and a
// global daily ceiling under the sentinel key '@global' (never a real IP), so a
// launch spike from many addresses is capped too. Fail-open on a D1 error, like
// the limiter this is lifted from.
// ponytail: single global counter row; shard the key if contention shows up.
const PER_IP_PER_HOUR = 5;
// 5/hour is 120/day per IP, so a 500 global ceiling is exhaustible by FIVE IPs
// pacing under their own limit — which would 429 the only email capture on the
// site for the rest of the day. Unlike the chat endpoint this replaced, a
// subscribe costs nothing per request (one D1 insert, no upstream billing), so
// the global axis is only bounding table growth: keep it far above plausible
// launch volume.
export const GLOBAL_PER_DAY = 5000;

async function rateLimited(c) {
  if (!c.env?.DB) return false;
  const now = Date.now();
  const hour = Math.floor(now / 3600000) * 3600000;
  const day = Math.floor(now / 86400000) * 86400000;
  const bump = (ip, windowStart) => c.env.DB.prepare(
    'INSERT INTO chat_rate (ip, window_start, count) VALUES (?,?,1) ' +
      'ON CONFLICT(ip, window_start) DO UPDATE SET count = count + 1 RETURNING count',
  ).bind(ip, windowStart).first();
  try {
    const mine = await bump(clientIp(c.req.raw), hour);
    if ((mine?.count || 0) === 1) {
      // Opportunistic prune, best-effort. Threshold is the start of today, which
      // is itself the global row's window_start — so today's counters survive.
      try { await c.env.DB.prepare('DELETE FROM chat_rate WHERE window_start < ?').bind(day).run(); } catch { /* best-effort */ }
    }
    // Early return, NOT `a || b`: an already-blocked IP must not spend the
    // global budget too, or one scripted address could 429 the whole site for
    // the rest of the day — turning the ceiling into an amplifier.
    if ((mine?.count || 0) > PER_IP_PER_HOUR) return true;
    const all = await bump('@global', day);
    return (all?.count || 0) > GLOBAL_PER_DAY;
  } catch {
    return false;
  }
}

export function mountBriefing(app) {
  // Email capture for logged-out visitors (landing page). Unauthenticated by
  // design. Writes to the STANDALONE briefing_subscribers table — never to
  // `users`, whose nullable pw_hash makes a public insert there squattable
  // (see 0006_briefing_subscribers.sql for the three proven consequences).
  app.post('/api/briefing/subscribe', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return c.json({ error: 'invalid_email' }, 400);
    // Without this the stored terms/ack versions are a timestamp of the Worker's
    // env, not evidence the subscriber agreed — the distinction CASL express
    // consent turns on. auth_password.js gates the same way before insertConsent.
    if (body.consent !== true) return c.json({ error: 'consent_required' }, 400);
    if (await rateLimited(c)) return c.json({ error: 'too_many_requests' }, 429);
    // INSERT OR IGNORE: re-submitting is not an error and the response is
    // identical either way, so this never leaks whether an address is known.
    // An already-unsubscribed row is left alone, so unsubscribes stick.
    // CASL consent evidence recorded inline (consents.user_id REFERENCES
    // users(id), and these rows are deliberately not users).
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO briefing_subscribers (email,id,created_at,consent_ip,terms_version,ack_version) VALUES (?,?,?,?,?,?)',
    ).bind(email, randomId(), Date.now(), clientIp(c.req.raw), c.env.TERMS_VERSION || null, c.env.ACK_VERSION || null).run();
    return c.json({ ok: true });
  });

  // One-click unsubscribe (RFC 8058): the mail client POSTs List-Unsubscribe=One-Click
  // to the List-Unsubscribe URL (token in the query). Must succeed without a UI.
  // This is also where the GET confirmation page's form lands.
  app.post('/api/briefing/unsubscribe', async (c) => {
    const id = await verifyToken(c.env, c.req.query('t') || '');
    if (!id) return c.text('invalid token', 400);
    await unsubscribe(c.env, id);
    // HTML, not text: the GET confirmation page's form lands here too, so a
    // human sees a real page. RFC 8058 one-click clients ignore the body.
    return c.html(PAGE('Unsubscribed', "You're unsubscribed",
      'You will no longer receive the MapleGamma Daily Briefing. You can re-subscribe anytime from your <a href="/#/account">account page</a>.'));
  });

  // Human-facing unsubscribe link (GET) — CONFIRMS, never writes. The Pi sender
  // uses this same URL for the visible body link AND the List-Unsubscribe
  // header, so a mutating GET let corporate link scanners and Outlook Safe
  // Links unsubscribe real people by merely fetching the mail. The form below
  // has no action attribute, so it POSTs back to this exact URL with ?t= intact.
  app.get('/api/briefing/unsubscribe', async (c) => {
    const id = await verifyToken(c.env, c.req.query('t') || '');
    if (!id) {
      return c.html(PAGE('Invalid link', 'Link invalid or expired',
        'Please use the unsubscribe link from a recent email, or manage email preferences on your <a href="/#/account">account page</a>.'), 400);
    }
    return c.html(PAGE('Confirm unsubscribe', 'Unsubscribe from the Daily Briefing?',
      'You will stop receiving the MapleGamma Daily Briefing. Nothing has changed yet.',
      '<form method="post"><button type="submit">Yes, unsubscribe me</button></form>'));
  });
}

// One verified id, two possible homes: a registered user (opt-in flag) or a
// landing-page capture (standalone table). Whichever holds it gets updated; the
// other statement is a no-op.
async function unsubscribe(env, id) {
  await setBriefingOptIn(env.DB, id, false);
  await env.DB.prepare('UPDATE briefing_subscribers SET unsubscribed_at=? WHERE id=? AND unsubscribed_at IS NULL')
    .bind(Date.now(), id).run();
}
