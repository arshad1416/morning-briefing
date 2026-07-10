import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getSubscription, upsertSubscription } from '../src/db.js';
import { issueSession } from '../src/session.js';

beforeAll(async () => {
  await migrate();
  Object.assign(env, {
    SESSION_SECRET: 'test-secret', MOCK_BILLING: '0',
    PRICE_BASIC: '49', PRICE_PRO: '99', CURRENCY: 'CAD',
    HELCIM_API_TOKEN: 'tok',
    HELCIM_PLAN_BASIC_MONTHLY: '101', HELCIM_PLAN_BASIC_ANNUAL: '102',
    HELCIM_PLAN_PRO_MONTHLY: '103', HELCIM_PLAN_PRO_ANNUAL: '104',
  });
});
afterEach(() => { vi.restoreAllMocks(); });

let n = 0;
async function session() {
  const u = await createUser(env.DB, { email: `bill${n++}@test.ca`, pwHash: 'h', ip: '1' });
  return { u, cookie: `mg_session=${await issueSession(u.id, env.SESSION_SECRET)}` };
}
function billKey(res) {
  const m = (res.headers.get('Set-Cookie') || '').match(/mg_bill_key=([^;]+)/);
  return m ? `mg_bill_key=${m[1]}` : '';
}
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const post = (path, cookie, body) => app.request(path, {
  method: 'POST', headers: { Cookie: cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
}, env);

describe('helcim billing', () => {
  it('rejects an invalid tier/interval', async () => {
    const { cookie } = await session();
    expect((await post('/api/billing/checkout', cookie, { tier: 'gold' })).status).toBe(400);
    expect((await post('/api/billing/checkout', cookie, { tier: 'basic', interval: 'weekly' })).status).toBe(400);
  });

  it('checkout initializes a verify session, stores it, sets the cookie', async () => {
    const { cookie } = await session();
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ checkoutToken: 'CHK', secretToken: 'SEC' }), { status: 200 }));
    const res = await post('/api/billing/checkout', cookie, { tier: 'pro', interval: 'annual' });
    expect(res.status).toBe(200);
    expect((await res.json()).checkoutToken).toBe('CHK');
    expect(billKey(res)).toMatch(/mg_bill_key=/);
    // verify = card capture only; Helcim requires amount 0 (the recurring amount
    // is set on the subscription in /confirm). Currency follows env (CAD).
    const bodySent = JSON.parse(spy.mock.calls[0][1].body);
    expect(bodySent).toMatchObject({ paymentType: 'verify', amount: 0, currency: 'CAD' });
  });

  it('confirm validates the hash and creates the subscription', async () => {
    const { cookie, u } = await session();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ checkoutToken: 'CHK', secretToken: 'SEC' }), { status: 200 }));
    const co = await post('/api/billing/checkout', cookie, { tier: 'basic', interval: 'monthly' });
    const bill = billKey(co);
    vi.restoreAllMocks();

    const data = { transactionId: 'T1', customerCode: 'CST9', status: 'APPROVED' };
    const hash = await sha256Hex(JSON.stringify(data) + 'SEC');
    const subSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 555, dateBilling: '2030-01-01' }] }), { status: 200 }));
    const res = await post('/api/billing/confirm', `${cookie}; ${bill}`, { data, hash });
    expect(res.status).toBe(200);
    const sent = JSON.parse(subSpy.mock.calls[0][1].body).subscriptions[0];
    expect(sent).toMatchObject({ paymentPlanId: 101, customerCode: 'CST9', recurringAmount: 49 });
    const sub = await getSubscription(env.DB, u.id);
    expect(sub.status).toBe('active');
    expect(sub.tier).toBe('basic');
    expect(sub.helcim_subscription_id).toBe('555');
    expect(sub.helcim_customer_id).toBe('CST9');
  });

  it('confirm rejects a forged hash', async () => {
    const { cookie } = await session();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ checkoutToken: 'CHK', secretToken: 'SEC' }), { status: 200 }));
    const co = await post('/api/billing/checkout', cookie, { tier: 'basic', interval: 'monthly' });
    const bill = billKey(co);
    vi.restoreAllMocks();
    const res = await post('/api/billing/confirm', `${cookie}; ${bill}`,
      { data: { customerCode: 'CSTx' }, hash: 'deadbeef' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('hash_mismatch');
  });

  it('cancel deletes the Helcim subscription and marks canceled', async () => {
    const { cookie, u } = await session();
    await upsertSubscription(env.DB, u.id, {
      tier: 'pro', status: 'active', billingInterval: 'monthly',
      helcimSubscriptionId: '777', periodEnd: Date.now() + 1e9,
    });
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const res = await post('/api/billing/cancel', cookie, {});
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0]).toContain('/subscriptions/777');
    expect(spy.mock.calls[0][1].method).toBe('DELETE');
    expect((await getSubscription(env.DB, u.id)).status).toBe('canceled');
  });

  it('webhook is inert until the verifier secret is set', async () => {
    delete env.HELCIM_WEBHOOK_VERIFIER;
    const res = await app.request('/api/billing/webhook', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"payment"}',
    }, env);
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe(true);
  });

  it('mock billing grants entitlement without Helcim', async () => {
    const { cookie, u } = await session();
    env.MOCK_BILLING = '1';
    const res = await post('/api/billing/checkout', cookie, { tier: 'basic', interval: 'annual' });
    env.MOCK_BILLING = '0';
    expect((await res.json()).mock).toBe(true);
    expect((await getSubscription(env.DB, u.id)).tier).toBe('basic');
  });
});
