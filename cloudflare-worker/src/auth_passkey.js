/**
 * Passkeys / WebAuthn — same technique as CompCeiling.
 *
 * Related Origin Requests (ROR): ONE canonical rpID (maplegamma.com) is used on
 * EVERY domain, so a single passkey works across maplegamma.com / .ca /
 * .arshadkazi.ca / briefing.arshadkazi.ca with no redirect or masking. The
 * browser authorizes a non-matching origin by fetching /.well-known/webauthn
 * from the rpID host and finding that origin in relatedOrigins(). Needs a modern
 * browser (Chrome 128+/Safari 18+); older ones fall back to password/Google.
 *
 * Login is USERNAMELESS: options carry no allowCredentials, the authenticator
 * offers whatever discoverable passkey it holds, and verify looks the credential
 * up by the assertion id. Challenges are single-use, keyed by an httpOnly cookie.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { requireSession, issueSession, setSessionCookie } from './session.js';
import {
  addCredential, getCredentialsByUser, getCredentialById, bumpCredentialCounter,
  storeWebauthnChallenge, takeWebauthnChallenge, logAuthEvent,
} from './db.js';
import { clientIp, randomId } from './util.js';

const WA_COOKIE = 'mg_wa_key';

const DEFAULT_ORIGINS = [
  'https://maplegamma.com',
  'https://maplegamma.ca',
  'https://briefing.arshadkazi.ca',
];

function rpId(env) { return env.WEBAUTHN_RP_ID || 'localhost'; }
function rpName(env) { return env.WEBAUTHN_RP_NAME || 'MapleGamma'; }
function expectedOrigins(env) {
  const raw = env.WEBAUTHN_ORIGINS;
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function relatedOrigins(env) {
  return expectedOrigins(env).filter((o) => !o.includes('localhost'));
}
function setWaCookie(c, key) {
  setCookie(c, WA_COOKIE, key, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
}

export function mountPasskey(app) {
  // Related Origin Requests: browsers fetch this from the rpID host during the
  // ceremony to authorize passkeys on the non-canonical domains.
  app.get('/.well-known/webauthn', (c) =>
    c.json({ origins: relatedOrigins(c.env) }, 200, { 'Cache-Control': 'public, max-age=3600' }),
  );

  // ── Registration (signed-in users adding a passkey) ──
  app.post('/api/auth/passkey/register/options', requireSession(), async (c) => {
    const { user } = c.get('session');
    const existing = await getCredentialsByUser(c.env.DB, user.id);
    const options = await generateRegistrationOptions({
      rpName: rpName(c.env),
      rpID: rpId(c.env),
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((cr) => ({
        id: cr.credential_id,
        transports: cr.transports ? cr.transports.split(',').filter(Boolean) : undefined,
      })),
      // residentKey REQUIRED (not "preferred"): usernameless sign-in has no
      // allowCredentials, so it only works with a *discoverable* credential.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const key = randomId();
    await storeWebauthnChallenge(c.env.DB, key, options.challenge, 'register', user.id);
    setWaCookie(c, key);
    return c.json(options);
  });

  app.post('/api/auth/passkey/register/verify', requireSession(), async (c) => {
    const { user } = c.get('session');
    const key = getCookie(c, WA_COOKIE);
    deleteCookie(c, WA_COOKIE, { path: '/' });
    if (!key) return c.json({ error: 'no_registration' }, 400);
    const challenge = await takeWebauthnChallenge(c.env.DB, key, 'register');
    if (!challenge) return c.json({ error: 'registration_expired' }, 400);

    const body = await c.req.json().catch(() => null);
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: challenge,
        expectedOrigin: expectedOrigins(c.env),
        expectedRPID: rpId(c.env),
      });
    } catch {
      return c.json({ error: 'verify_failed' }, 400);
    }
    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: 'not_verified' }, 400);
    }
    const cred = verification.registrationInfo.credential;
    const transports = body?.response?.transports || [];
    await addCredential(c.env.DB, {
      userId: user.id,
      credentialId: cred.id,
      publicKey: isoBase64URL.fromBuffer(cred.publicKey),
      counter: cred.counter,
      transports: transports.join(','),
    });
    return c.json({ ok: true });
  });

  // ── Authentication (usernameless) ──
  app.post('/api/auth/passkey/login/options', async (c) => {
    const options = await generateAuthenticationOptions({
      rpID: rpId(c.env),
      userVerification: 'preferred',
    });
    const key = randomId();
    await storeWebauthnChallenge(c.env.DB, key, options.challenge, 'auth', null);
    setWaCookie(c, key);
    return c.json(options);
  });

  app.post('/api/auth/passkey/login/verify', async (c) => {
    const key = getCookie(c, WA_COOKIE);
    deleteCookie(c, WA_COOKIE, { path: '/' });
    if (!key) return c.json({ error: 'no_signin' }, 400);
    const challenge = await takeWebauthnChallenge(c.env.DB, key, 'auth');
    if (!challenge) return c.json({ error: 'signin_expired' }, 400);

    const body = await c.req.json().catch(() => null);
    const credId = body?.id;
    if (!credId) return c.json({ error: 'bad_assertion' }, 400);
    const cred = await getCredentialById(c.env.DB, credId);
    if (!cred) return c.json({ error: 'unknown_credential' }, 401);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: challenge,
        expectedOrigin: expectedOrigins(c.env),
        expectedRPID: rpId(c.env),
        credential: {
          id: cred.credential_id,
          publicKey: isoBase64URL.toBuffer(cred.public_key),
          counter: cred.counter,
          transports: cred.transports ? cred.transports.split(',').filter(Boolean) : undefined,
        },
      });
    } catch {
      return c.json({ error: 'verify_failed' }, 400);
    }
    if (!verification.verified) return c.json({ error: 'not_verified' }, 401);

    await bumpCredentialCounter(c.env.DB, cred.credential_id, verification.authenticationInfo.newCounter);
    await logAuthEvent(c.env.DB, { email: null, ip: clientIp(c.req.raw), type: 'login_ok' });
    const token = await issueSession(cred.user_id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true });
  });
}
