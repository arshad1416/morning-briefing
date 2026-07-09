import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, upsertSubscription } from '../src/db.js';
import { issueSession } from '../src/session.js';

beforeAll(async () => {
  await migrate();
  env.SESSION_SECRET = 'test-secret';
});

// Per-test storage is isolated (rolled back), so seed R2 inside each test frame.
beforeEach(async () => {
  await env.PRIVATE.put('screener-data.json', JSON.stringify({ tickers: [{ ticker: 'AAPL' }] }));
  await env.PRIVATE.put('charts/AAPL.json', JSON.stringify({ ticker: 'AAPL', timeframes: {} }));
});

async function sessionFor(email, sub) {
  const u = await createUser(env.DB, { email, pwHash: 'h', ip: '1' });
  if (sub) await upsertSubscription(env.DB, u.id, sub);
  return { u, cookie: `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}` };
}

describe('hard data gate', () => {
  it('401 without a session', async () => {
    const res = await app.request('/api/data/screener-data.json', {}, env);
    expect(res.status).toBe(401);
  });

  it('403 when signed in but no active subscription', async () => {
    const { cookie } = await sessionFor('nosub@test.ca', null);
    const res = await app.request('/api/data/screener-data.json', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(403);
  });

  it('200 streams a basic file for a trial user', async () => {
    const { cookie } = await sessionFor('trial@test.ca', { tier: 'trial', status: 'active', trialEndsAt: Date.now() + 86400000 });
    const res = await app.request('/api/data/screener-data.json', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
    expect((await res.json()).tickers[0].ticker).toBe('AAPL');
  });

  it('basic subscriber gets basic files but 403 on pro (charts)', async () => {
    const { cookie } = await sessionFor('basic@test.ca', { tier: 'basic', status: 'active' });
    const ok = await app.request('/api/data/screener-data.json', { headers: { Cookie: cookie } }, env);
    expect(ok.status).toBe(200);
    const pro = await app.request('/api/data/charts/AAPL.json', { headers: { Cookie: cookie } }, env);
    expect(pro.status).toBe(403);
  });

  it('pro subscriber gets charts', async () => {
    const { cookie } = await sessionFor('pro@test.ca', { tier: 'pro', status: 'active' });
    const res = await app.request('/api/data/charts/AAPL.json', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
  });

  it('404 for a non-gated (public) filename', async () => {
    const { cookie } = await sessionFor('x@test.ca', { tier: 'pro', status: 'active' });
    const res = await app.request('/api/data/latest.json', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(404);
  });

  it('rejects path traversal', async () => {
    const { cookie } = await sessionFor('trav@test.ca', { tier: 'pro', status: 'active' });
    const res = await app.request('/api/data/..%2f..%2fsecret', { headers: { Cookie: cookie } }, env);
    expect([400, 404]).toContain(res.status);
  });
});
