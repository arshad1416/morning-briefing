import { getCookie, setCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, DUMMY_HASH } from './password.js';
import {
  createUser, getUserByEmail, getUserById, insertConsent, logAuthEvent, recentAuthFailures, setBriefingOptIn,
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
    // briefingOptIn is an OPTIONAL, separate preference (CASL): default off,
    // never bundled with the required consent gate above.
    const user = await createUser(c.env.DB, { email, pwHash, ip, briefingOptIn: !!body.briefingOptIn });
    await insertConsent(c.env.DB, user.id, consent.consent);
    await logAuthEvent(c.env.DB, { email, ip, type: 'signup' });

    const deviceId = ensureDevice(c);
    // Best-effort trial: the account already exists, so a DB hiccup here must
    // not fail the signup.
    try { await startTrial(c.env.DB, { userId: user.id, deviceId, ip }); } catch (e) { /* best-effort */ }

    const token = await issueSession(user.id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true, email });
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const ip = clientIp(c.req.raw);

    // Verify the password FIRST so a correct password is never throttled — only
    // repeated FAILURES are rate-limited (prevents a targeted lockout DoS where
    // an attacker floods wrong guesses to lock a victim out of their own login).
    const user = await getUserByEmail(c.env.DB, email);
    const ok = await verifyPassword(password, user?.pw_hash || DUMMY_HASH);
    if (user && user.pw_hash && ok) {
      await logAuthEvent(c.env.DB, { email, ip, type: 'login_ok' });
      ensureDevice(c);
      const token = await issueSession(user.id, c.env.SESSION_SECRET);
      setSessionCookie(c, token);
      return c.json({ ok: true, email });
    }
    // failure path — throttle repeated failures
    await logAuthEvent(c.env.DB, { email, ip, type: 'login_fail' });
    if (await recentAuthFailures(c.env.DB, email, 15 * 60 * 1000) >= 8) {
      return c.json({ error: 'too_many_attempts' }, 429);
    }
    return c.json({ error: 'invalid_credentials' }, 401);
  });

  app.post('/api/auth/logout', (c) => { clearSessionCookie(c); return c.json({ ok: true }); });

  app.get('/api/auth/me', requireSession(), async (c) => {
    const { user } = c.get('session');
    const ent = await entitlement(c.env.DB, user.id);
    return c.json({ id: user.id, email: user.email, briefingOptIn: !!user.briefing_opt_in, entitlement: ent });
  });

  // Toggle the Morning Briefing email opt-in from the account page.
  app.post('/api/account/briefing', requireSession(), async (c) => {
    const { user } = c.get('session');
    const body = await c.req.json().catch(() => ({}));
    const optIn = !!body.optIn;
    await setBriefingOptIn(c.env.DB, user.id, optIn);
    return c.json({ ok: true, briefingOptIn: optIn });
  });
}
