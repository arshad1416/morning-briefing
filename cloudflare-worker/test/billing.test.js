import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getSubscription } from '../src/db.js';
import { issueSession } from '../src/session.js';

beforeAll(async () => { await migrate(); env.SESSION_SECRET = 'test-secret'; env.MOCK_BILLING = '1'; });

describe('mock billing', () => {
  it('mock checkout activates the chosen tier for the signed-in user', async () => {
    const u = await createUser(env.DB, { email: 'buy@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/billing/checkout', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'pro' }),
    }, env);
    expect(res.status).toBe(200);
    const sub = await getSubscription(env.DB, u.id);
    expect(sub.tier).toBe('pro');
    expect(sub.status).toBe('active');
  });

  it('rejects an unknown tier', async () => {
    const u = await createUser(env.DB, { email: 'buy2@test.ca', pwHash: 'h', ip: '1' });
    const cookie = `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}`;
    const res = await app.request('/api/billing/checkout', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'diamond' }),
    }, env);
    expect(res.status).toBe(400);
  });
});
