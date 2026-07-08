import { getCookie, setCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, DUMMY_HASH } from './password.js';
import {
  createUser, getUserByEmail, getUserById, insertConsent, logAuthEvent, recentAuthFailures,
} from './db.js';
import { issueSession, setSessionCookie, clearSessionCookie, requireSession, entitlement } from './session.js';
import { validateConsent } from './legal.js';
import { startTrial } from './trial.js';
import { clientIp, randomId } from './util.js';

const DEVICE_COOKIE = 'mg_device';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ensureDevice(c) {
  let d = getCookie(c, DEVICE_COOKIE);
  if (!d) {
    d = randomId();
    setCookie(c, DEVICE_COOKIE, d, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 24 * 3600 });
  }
  return d;
}

export function mountPasswordAuth(app) {
  app.post('/api/auth/signup', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!EMAIL_RE.test(email)) return c.json({ error: 'invalid_email' }, 400);
    if (password.length < 10) return c.json({ error: 'weak_password' }, 400);

    const consent = validateConsent(body, c.env);
    if (!consent.ok) return c.json({ error: consent.error }, consent.error === 'quebec_not_available' ? 403 : 400);

    if (await getUserByEmail(c.env.DB, email)) return c.json({ error: 'email_taken' }, 409);

    const ip = clientIp(c.req.raw);
    const pwHash = await hashPassword(password);
    const user = await createUser(c.env.DB, { email, pwHash, ip });
    await insertConsent(c.env.DB, user.id, consent.consent);
    await logAuthEvent(c.env.DB, { email, ip, type: 'signup' });

    const deviceId = ensureDevice(c);
    await startTrial(c.env.DB, { userId: user.id, deviceId, ip });

    const token = await issueSession(user.id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true, email });
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const ip = clientIp(c.req.raw);

    if (await recentAuthFailures(c.env.DB, email, 15 * 60 * 1000) >= 8) {
      await logAuthEvent(c.env.DB, { email, ip, type: 'rate_limited' });
      return c.json({ error: 'too_many_attempts' }, 429);
    }
    const user = await getUserByEmail(c.env.DB, email);
    const ok = await verifyPassword(password, user?.pw_hash || DUMMY_HASH);
    if (!user || !user.pw_hash || !ok) {
      await logAuthEvent(c.env.DB, { email, ip, type: 'login_fail' });
      return c.json({ error: 'invalid_credentials' }, 401);
    }
    await logAuthEvent(c.env.DB, { email, ip, type: 'login_ok' });
    ensureDevice(c);
    const token = await issueSession(user.id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true, email });
  });

  app.post('/api/auth/logout', (c) => { clearSessionCookie(c); return c.json({ ok: true }); });

  app.get('/api/auth/me', requireSession(), async (c) => {
    const { user } = c.get('session');
    const ent = await entitlement(c.env.DB, user.id);
    return c.json({ id: user.id, email: user.email, entitlement: ent });
  });
}
