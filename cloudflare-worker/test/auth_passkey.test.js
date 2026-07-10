import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';
import { createUser, getCredentialsByUser } from '../src/db.js';
import { issueSession } from '../src/session.js';
import * as swa from '@simplewebauthn/server';

// NOTE (mocking mechanism): @cloudflare/vitest-pool-workers exposes
// `@simplewebauthn/server` as a frozen ESM namespace, so `vi.spyOn(swa, ...)`
// throws "Cannot redefine property". We substitute the whole module via a
// `vi.mock` factory instead — real `generate*Options` are preserved, only the
// two `verify*Response` fns are replaced. Return shapes + assertions unchanged.
vi.mock('@simplewebauthn/server', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, verifyRegistrationResponse: vi.fn(), verifyAuthenticationResponse: vi.fn() };
});

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
  // Use the same env var names as production (WEBAUTHN_*), so the handlers'
  // rpId()/rpName()/expectedOrigins() helpers resolve the way they do live.
  env.WEBAUTHN_RP_ID = 'maplegamma.com';
  env.WEBAUTHN_RP_NAME = 'MapleGamma';
  env.WEBAUTHN_ORIGINS = 'https://maplegamma.com';
  env.APP_URL = 'https://maplegamma.com';
});
afterEach(() => vi.restoreAllMocks());

describe('passkey', () => {
  it('register/options requires a session', async () => {
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });

  it('register/options returns a challenge for a signed-in user', async () => {
    const u = await createUser(env.DB, { email: 'pk@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBeTruthy();
    expect(body.challengeId).toBeTruthy();
  });

  it('register/verify stores a credential on success', async () => {
    const u = await createUser(env.DB, { email: 'pk2@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const opts = await (await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: cookie } }, env)).json();
    // v11.0.0 shape: registrationInfo.credential = { id, publicKey: Uint8Array, counter, transports }
    vi.mocked(swa.verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] },
      },
    });
    const res = await app.request('/api/auth/passkey/register/verify', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, response: { fake: true } }),
    }, env);
    expect(res.status).toBe(200);
    expect((await getCredentialsByUser(env.DB, u.id)).length).toBe(1);
  });

  it('login/verify issues a session on success', async () => {
    const u = await createUser(env.DB, { email: 'pk3@test.ca', pwHash: null, ip: '1' });
    await env.DB.prepare('INSERT INTO credentials (id,user_id,credential_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind('row1', u.id, 'cred-9', btoa('key'), 0, 'internal', Date.now()).run();
    const optsRes = await app.request('/api/auth/passkey/login/options', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pk3@test.ca' }),
    }, env);
    const opts = await optsRes.json();
    vi.mocked(swa.verifyAuthenticationResponse).mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } });
    const res = await app.request('/api/auth/passkey/login/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: opts.challengeId, credentialId: 'cred-9', response: { fake: true } }),
    }, env);
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toContain('mg_session=');
  });
});
