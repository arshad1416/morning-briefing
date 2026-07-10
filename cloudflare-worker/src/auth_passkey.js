import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { requireSession, issueSession, setSessionCookie } from './session.js';
import {
  getUserByEmail, addCredential, getCredentialsByUser, getCredentialById,
  bumpCredentialCounter, putChallenge, takeChallenge, logAuthEvent,
} from './db.js';
import { clientIp } from './util.js';

const WA_COOKIE = 'mg_wa_key';

const DEFAULT_ORIGINS = [
  'https://maplegamma.com',
  'https://maplegamma.ca',
  'https://maplegamma.arshadkazi.ca',
  'https://briefing.arshadkazi.ca',
];

function rpId(env) { return env.WEBAUTHN_RP_ID || 'localhost'; }
function rpName(env) { return env.WEBAUTHN_RP_NAME || 'MapleGamma'; }
function expectedOrigins(env) {
  const raw = env.WEBAUTHN_ORIGINS;
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function mountPasskey(app) {
  app.post('/api/auth/passkey/register/options', requireSession(), async (c) => {
    const { user } = c.get('session');
    const existing = await getCredentialsByUser(c.env.DB, user.id);
    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME, rpID: c.env.RP_ID,
      userID: new TextEncoder().encode(user.id), userName: user.email,
      attestationType: 'none',
      excludeCredentials: existing.map((cr) => ({ id: cr.credential_id })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    const challengeId = await putChallenge(c.env.DB, { userId: user.id, challenge: options.challenge, type: 'register' });
    return c.json({ ...options, challengeId });
  });

  app.post('/api/auth/passkey/register/verify', requireSession(), async (c) => {
    const { user } = c.get('session');
    const { challengeId, response } = await c.req.json().catch(() => ({}));
    const ch = await takeChallenge(c.env.DB, challengeId);
    if (!ch || ch.user_id !== user.id || ch.type !== 'register') return c.json({ error: 'bad_challenge' }, 400);
    let result;
    try {
      result = await verifyRegistrationResponse({
        response, expectedChallenge: ch.challenge,
        expectedOrigin: c.env.APP_URL, expectedRPID: c.env.RP_ID,
      });
    } catch { return c.json({ error: 'verify_failed' }, 400); }
    if (!result.verified || !result.registrationInfo) return c.json({ error: 'not_verified' }, 400);
    // @simplewebauthn/server v11.0.0: registrationInfo.credential = { id, publicKey (Uint8Array), counter, transports }
    const cred = result.registrationInfo.credential;
    await addCredential(c.env.DB, {
      userId: user.id,
      credentialId: cred.id,
      publicKey: b64url(cred.publicKey),
      counter: cred.counter || 0,
      transports: (cred.transports || []).join(','),
    });
    return c.json({ ok: true });
  });

  app.post('/api/auth/passkey/login/options', async (c) => {
    const { email } = await c.req.json();
    const user = email ? await getUserByEmail(c.env.DB, email) : null;
    const creds = user ? await getCredentialsByUser(c.env.DB, user.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials: creds.map((cr) => ({ id: cr.credential_id, transports: (cr.transports || '').split(',').filter(Boolean) })),
      userVerification: 'preferred',
    });
    const challengeId = await putChallenge(c.env.DB, { userId: user?.id || null, challenge: options.challenge, type: 'login' });
    return c.json({ ...options, challengeId });
  });

  app.post('/api/auth/passkey/login/verify', async (c) => {
    const { challengeId, credentialId, response } = await c.req.json().catch(() => ({}));
    const ch = await takeChallenge(c.env.DB, challengeId);
    if (!ch || ch.type !== 'login') return c.json({ error: 'bad_challenge' }, 400);
    const cred = await getCredentialById(c.env.DB, credentialId);
    if (!cred) return c.json({ error: 'unknown_credential' }, 400);
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response, expectedChallenge: ch.challenge,
        expectedOrigin: c.env.APP_URL, expectedRPID: c.env.RP_ID,
        // v11.0.0: `credential` param is a WebAuthnCredential { id, publicKey (Uint8Array), counter }
        credential: { id: cred.credential_id, publicKey: unb64url(cred.public_key), counter: cred.counter },
      });
    } catch { return c.json({ error: 'verify_failed' }, 400); }
    if (!result.verified) return c.json({ error: 'not_verified' }, 400);
    await bumpCredentialCounter(c.env.DB, cred.credential_id, result.authenticationInfo.newCounter);
    await logAuthEvent(c.env.DB, { email: null, ip: clientIp(c.req.raw), type: 'login_ok' });
    const token = await issueSession(cred.user_id, c.env.SESSION_SECRET);
    setSessionCookie(c, token);
    return c.json({ ok: true });
  });
}
