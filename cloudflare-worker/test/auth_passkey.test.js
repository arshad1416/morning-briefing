import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
// vi.spyOn on a namespace can't intercept auth_passkey.js's direct named
// imports in the workers pool — replace the module so the bindings are mocks.
const { mockVerifyReg, mockVerifyAuth } = vi.hoisted(() => ({
  mockVerifyReg: vi.fn(),
  mockVerifyAuth: vi.fn(),
}));
vi.mock('@simplewebauthn/server', async (orig) => ({
  ...(await orig()),
  verifyRegistrationResponse: mockVerifyReg,
  verifyAuthenticationResponse: mockVerifyAuth,
}));
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getCredentialsByUser } from '../src/db.js';
import { issueSession } from '../src/session.js';

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
  env.WEBAUTHN_RP_ID = 'maplegamma.com';
  env.WEBAUTHN_RP_NAME = 'MapleGamma';
  env.WEBAUTHN_ORIGINS = 'https://maplegamma.com,https://maplegamma.ca';
});
afterEach(() => vi.restoreAllMocks());

function waCookie(res) {
  const m = (res.headers.get('Set-Cookie') || '').match(/mg_wa_key=([^;]+)/);
  return m ? `mg_wa_key=${m[1]}` : '';
}

describe('passkey (ROR / usernameless — CompCeiling technique)', () => {
  it('/.well-known/webauthn lists the related origins (no localhost)', async () => {
    const res = await app.request('/.well-known/webauthn', {}, env);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.origins).toContain('https://maplegamma.com');
    expect(b.origins).toContain('https://maplegamma.ca');
  });

  it('register/options requires a session', async () => {
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });

  it('register/options returns options + sets the challenge cookie', async () => {
    const u = await createUser(env.DB, { email: 'pk@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
    expect((await res.json()).challenge).toBeTruthy();
    expect(waCookie(res)).toContain('mg_wa_key=');
  });

  it('register/verify stores a credential on success', async () => {
    const u = await createUser(env.DB, { email: 'pk2@test.ca', pwHash: 'h', ip: '1' });
    const sess = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const optRes = await app.request('/api/auth/passkey/register/options', { method: 'POST', headers: { Cookie: sess } }, env);
    const wa = waCookie(optRes);
    mockVerifyReg.mockResolvedValue({
      verified: true,
      registrationInfo: { credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0 } },
    });
    const res = await app.request('/api/auth/passkey/register/verify', {
      method: 'POST', headers: { Cookie: `${sess}; ${wa}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'cred-1', response: { transports: ['internal'] } }),
    }, env);
    expect(res.status).toBe(200);
    expect((await getCredentialsByUser(env.DB, u.id)).length).toBe(1);
  });

  it('usernameless login/verify issues a session (looks up cred by assertion id)', async () => {
    const u = await createUser(env.DB, { email: 'pk3@test.ca', pwHash: null, ip: '1' });
    await env.DB.prepare('INSERT INTO credentials (id,user_id,credential_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind('row1', u.id, 'cred-9', 'AQID', 0, 'internal', Date.now()).run();
    const optRes = await app.request('/api/auth/passkey/login/options', { method: 'POST' }, env);
    const wa = waCookie(optRes);
    mockVerifyAuth.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1 } });
    const res = await app.request('/api/auth/passkey/login/verify', {
      method: 'POST', headers: { Cookie: wa, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'cred-9', response: {} }),
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie') || '').toContain('mg_session=');
  });

  it('login/verify rejects an unknown credential id', async () => {
    const optRes = await app.request('/api/auth/passkey/login/options', { method: 'POST' }, env);
    const wa = waCookie(optRes);
    const res = await app.request('/api/auth/passkey/login/verify', {
      method: 'POST', headers: { Cookie: wa, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'does-not-exist', response: {} }),
    }, env);
    expect(res.status).toBe(401);
  });
});
