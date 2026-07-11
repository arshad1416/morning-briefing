import { setBriefingOptIn } from './db.js';

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

async function verifyToken(env, t) {
  const dot = (t || '').lastIndexOf('.');
  if (dot <= 0 || !env.BRIEFING_UNSUB_SECRET) return null;
  const userId = t.slice(0, dot);
  const sig = t.slice(dot + 1);
  const expect = await hmacHex(env.BRIEFING_UNSUB_SECRET, userId);
  return timingSafeEqual(sig, expect) ? userId : null;
}

const PAGE = (title, heading, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — MapleGamma</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0e1a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:20px}
.card{max-width:460px;text-align:center;line-height:1.6}h1{color:#f0bf66;font-size:1.4rem;margin:0 0 12px}p{color:#cbd5e1;font-size:0.95rem}a{color:#f0bf66}</style></head>
<body><div class="card"><h1>${heading}</h1><p>${body}</p></div></body></html>`;

export function mountBriefing(app) {
  // One-click unsubscribe (RFC 8058): the mail client POSTs List-Unsubscribe=One-Click
  // to the List-Unsubscribe URL (token in the query). Must succeed without a UI.
  app.post('/api/briefing/unsubscribe', async (c) => {
    const userId = await verifyToken(c.env, c.req.query('t') || '');
    if (!userId) return c.text('invalid token', 400);
    await setBriefingOptIn(c.env.DB, userId, false);
    return c.text('unsubscribed', 200);
  });

  // Human-facing unsubscribe link (GET).
  app.get('/api/briefing/unsubscribe', async (c) => {
    const userId = await verifyToken(c.env, c.req.query('t') || '');
    if (!userId) {
      return c.html(PAGE('Invalid link', 'Link invalid or expired',
        'Please use the unsubscribe link from a recent email, or manage email preferences on your <a href="/#/account">account page</a>.'), 400);
    }
    await setBriefingOptIn(c.env.DB, userId, false);
    return c.html(PAGE('Unsubscribed', "You're unsubscribed",
      'You will no longer receive the MapleGamma Daily Briefing. You can re-subscribe anytime from your <a href="/#/account">account page</a>.'));
  });
}
