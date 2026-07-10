import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';

beforeAll(async () => { await migrate(); env.SESSION_SECRET = 'test-secret'; });

const signup = (body) => app.request('/api/auth/signup', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}, env);
const base = { password: 'hunter2hunter2', acceptTerms: true, acceptAck: true, notQuebec: true };

describe('password auth', () => {
  it('signup creates an account + trial + session, and blocks Quebec', async () => {
    const res = await signup({ ...base, email: 'user@test.ca' });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toContain('mg_session=');
    const qc = await signup({ ...base, email: 'qc@test.ca', notQuebec: false });
    expect(qc.status).toBe(403);
    expect((await qc.json()).error).toBe('quebec_not_available');
  });

  it('rejects duplicate email', async () => {
    const dup = { ...base, email: 'dup@test.ca' };
    expect((await signup(dup)).status).toBe(200);
    expect((await signup(dup)).status).toBe(409); // same email again, same test → persists
  });

  it('login works with correct password, fails with wrong', async () => {
    const cred = { ...base, email: 'login@test.ca' };
    expect((await signup(cred)).status).toBe(200); // create within this test
    const ok = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@test.ca', password: 'hunter2hunter2' }),
    }, env);
    expect(ok.status).toBe(200);
    const bad = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@test.ca', password: 'nope' }),
    }, env);
    expect(bad.status).toBe(401);
  });

  it('a correct password is never throttled, even after repeated failures (lockout DoS)', async () => {
    const cred = { ...base, email: 'dos@test.ca' };
    expect((await signup(cred)).status).toBe(200); // create within this test (isolatedStorage)
    const login = (password) => app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dos@test.ca', password }),
    }, env);
    // Attacker floods wrong guesses to try to lock the victim out.
    for (let i = 0; i < 8; i++) {
      const bad = await login('wrongwrongwrong');
      expect([401, 429]).toContain(bad.status);
    }
    // The real owner's CORRECT password must still succeed — not throttled.
    const good = await login('hunter2hunter2');
    expect(good.status).toBe(200);
    expect(sessionCookie(good)).toContain('mg_session=');
  });

  it('me returns entitlement for a signed-in user', async () => {
    const res = await signup({ ...base, email: 'me@test.ca' });
    const cookie = sessionCookie(res);
    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } }, env);
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.email).toBe('me@test.ca');
    expect(body.entitlement.entitled).toBe(true); // fresh trial
  });

  it('me is 401 without a session', async () => {
    const me = await app.request('/api/auth/me', {}, env);
    expect(me.status).toBe(401);
  });

  it('briefing opt-in defaults off, is captured at signup, and toggles from the account endpoint', async () => {
    // Default: no briefingOptIn in the payload → off.
    const off = await signup({ ...base, email: 'brief-off@test.ca' });
    const offMe = await (await app.request('/api/auth/me', { headers: { Cookie: sessionCookie(off) } }, env)).json();
    expect(offMe.briefingOptIn).toBe(false);

    // Opted in at signup → on.
    const on = await signup({ ...base, email: 'brief-on@test.ca', briefingOptIn: true });
    const cookie = sessionCookie(on);
    const onMe = await (await app.request('/api/auth/me', { headers: { Cookie: cookie } }, env)).json();
    expect(onMe.briefingOptIn).toBe(true);

    // Toggle off via the account endpoint.
    const upd = await app.request('/api/account/briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ optIn: false }),
    }, env);
    expect(upd.status).toBe(200);
    const after = await (await app.request('/api/auth/me', { headers: { Cookie: cookie } }, env)).json();
    expect(after.briefingOptIn).toBe(false);
  });

  it('briefing toggle requires a session', async () => {
    const res = await app.request('/api/account/briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optIn: true }),
    }, env);
    expect(res.status).toBe(401);
  });
});
