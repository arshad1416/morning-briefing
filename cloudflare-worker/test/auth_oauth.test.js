import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate, sessionCookie } from './helpers.js';
import { getUserByEmail, createUser } from '../src/db.js';

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
  env.GOOGLE_CLIENT_ID = 'cid';
  env.GOOGLE_CLIENT_SECRET = 'csecret';
  env.APP_URL = 'https://briefing.arshadkazi.ca';
});
afterEach(() => vi.restoreAllMocks());

describe('google oauth', () => {
  it('start redirects to Google with state cookie', async () => {
    const res = await app.request('/api/auth/oauth/google/start', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('accounts.google.com');
    expect(res.headers.get('Set-Cookie')).toContain('mg_oauth_state=');
  });

  it('callback exchanges code, creates user, sets session', async () => {
    const start = await app.request('/api/auth/oauth/google/start', {}, env);
    const stateCookie = (start.headers.get('Set-Cookie').match(/mg_oauth_state=([^;]+)/))[1];
    const state = new URL(start.headers.get('Location')).searchParams.get('state');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      if (String(url).includes('googleapis.com/oauth2/v3/userinfo'))
        return new Response(JSON.stringify({ sub: 'g-123', email: 'goog@test.ca', email_verified: true }), { status: 200 });
      throw new Error('unexpected fetch ' + url);
    });

    const res = await app.request(`/api/auth/oauth/google/callback?code=abc&state=${state}`,
      { headers: { Cookie: `mg_oauth_state=${stateCookie}` } }, env);
    expect(res.status).toBe(302);
    expect(sessionCookie(res)).toContain('mg_session=');
    expect(await getUserByEmail(env.DB, 'goog@test.ca')).toBeTruthy();
  });

  it('callback rejects mismatched state (CSRF)', async () => {
    const res = await app.request('/api/auth/oauth/google/callback?code=abc&state=evil',
      { headers: { Cookie: 'mg_oauth_state=other' } }, env);
    expect(res.status).toBe(400);
  });

  it('callback refuses to silently link Google to a password account (pre-reg hijack)', async () => {
    // Attacker pre-registered this email WITH a password. When the real owner
    // uses "Continue with Google", the callback must NOT link+login onto the
    // attacker's row — it must bounce to the account page with an error.
    await createUser(env.DB, { email: 'hijack@test.ca', pwHash: 'x', ip: null });

    const start = await app.request('/api/auth/oauth/google/start', {}, env);
    const stateCookie = (start.headers.get('Set-Cookie').match(/mg_oauth_state=([^;]+)/))[1];
    const state = new URL(start.headers.get('Location')).searchParams.get('state');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token'))
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      if (String(url).includes('googleapis.com/oauth2/v3/userinfo'))
        return new Response(JSON.stringify({ sub: 'g-x', email: 'hijack@test.ca', email_verified: true }), { status: 200 });
      throw new Error('unexpected fetch ' + url);
    });

    const res = await app.request(`/api/auth/oauth/google/callback?code=abc&state=${state}`,
      { headers: { Cookie: `mg_oauth_state=${stateCookie}` } }, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('error=use_password');
    expect(sessionCookie(res)).toBe(''); // no session issued onto the password account
  });
});
