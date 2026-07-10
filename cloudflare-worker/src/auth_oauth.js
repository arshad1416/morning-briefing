import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createUser, getUserByEmail, getOauthIdentity, linkOauthIdentity, logAuthEvent, insertConsent } from './db.js';
import { issueSession, setSessionCookie } from './session.js';
import { startTrial } from './trial.js';
import { clientIp, randomId } from './util.js';

const STATE_COOKIE = 'mg_oauth_state';
const DEVICE_COOKIE = 'mg_device';
// Set only when /start is hit with ?c=1 (from the signup page, after the
// Terms/not-advice/not-Quebec boxes are ticked). The callback requires it
// before minting a brand-new Google account, so "Continue with Google" on the
// consent-free login page can't create an un-attested account.
const CONSENT_COOKIE = 'mg_oauth_consent';

export function mountOauth(app) {
  app.get('/api/auth/oauth/google/start', (c) => {
    const state = randomId();
    setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    // Consent attestation carried from the signup page (?c=1). Short-lived; read
    // and cleared at the callback. Absent for the login page's Google button.
    if (c.req.query('c') === '1') {
      setCookie(c, CONSENT_COOKIE, '1', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
    }
    const p = new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${c.env.APP_URL}/api/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email',
      state,
      prompt: 'select_account',
    });
    return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`, 302);
  });

  app.get('/api/auth/oauth/google/callback', async (c) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieState = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/' });
    if (!code || !state || !cookieState || state !== cookieState) return c.json({ error: 'bad_state' }, 400);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: c.env.GOOGLE_CLIENT_ID, client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.APP_URL}/api/auth/oauth/google/callback`, grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return c.json({ error: 'token_exchange_failed' }, 400);
    const { access_token } = await tokenRes.json();

    const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!uiRes.ok) return c.json({ error: 'userinfo_failed' }, 400);
    const profile = await uiRes.json();
    if (!profile.email || profile.email_verified !== true) return c.json({ error: 'email_unverified' }, 400);

    const email = String(profile.email).toLowerCase();
    const ip = clientIp(c.req.raw);

    let identity = await getOauthIdentity(c.env.DB, 'google', profile.sub);
    let userId;
    if (identity) {
      userId = identity.user_id;
    } else {
      const existing = await getUserByEmail(c.env.DB, email);
      // Anti-hijack: never silently link Google onto a row that already has a
      // password — an attacker could pre-register the victim's email. Linking
      // stays allowed only for OAuth/passkey-created rows (no pw_hash).
      if (existing && existing.pw_hash) {
        return c.redirect(`${c.env.APP_URL}/#/login?error=use_password`, 302);
      }
      // Consent gate for brand-new Google accounts. Read + clear the attestation
      // cookie set by /start?c=1 (signup page). A never-seen Google email
      // arriving without it (e.g. from the login page's Google button) is
      // bounced to signup to accept the Terms / not-advice / not-Quebec gate
      // rather than being created here — matching the password signup path.
      const consented = getCookie(c, CONSENT_COOKIE) === '1';
      deleteCookie(c, CONSENT_COOKIE, { path: '/' });
      if (!existing && !consented) {
        return c.redirect(`${c.env.APP_URL}/#/signup?error=consent`, 302);
      }
      const user = existing || (await createUser(c.env.DB, { email, pwHash: null, ip }));
      userId = user.id;
      await linkOauthIdentity(c.env.DB, { provider: 'google', providerUserId: profile.sub, userId, email });
      if (!existing) {
        // Record the consent attested on the signup page (we only reach account
        // creation when the ?c=1 consent cookie was set — i.e. the Terms /
        // not-advice / not-Quebec boxes were ticked). Gives Google sign-ups the
        // same server-side consent audit trail as the password path.
        await insertConsent(c.env.DB, userId, {
          termsVersion: c.env.TERMS_VERSION, ackVersion: c.env.ACK_VERSION, quebecAttested: true,
        });
        await logAuthEvent(c.env.DB, { email, ip, type: 'signup' });
        const deviceId = getCookie(c, DEVICE_COOKIE) || randomId();
        setCookie(c, DEVICE_COOKIE, deviceId, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 400 * 24 * 3600 });
        await startTrial(c.env.DB, { userId, deviceId, ip });
      }
    }
    await logAuthEvent(c.env.DB, { email, ip, type: 'login_ok' });
    const token = await issueSession(userId, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.redirect(`${c.env.APP_URL}/#/`, 302);
  });
}
