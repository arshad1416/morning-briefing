import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, upsertSubscription } from '../src/db.js';
import { issueSession, verifySession, entitlement } from '../src/session.js';

beforeAll(() => migrate());
const SECRET = 'test-secret';

describe('session', () => {
  it('round-trips a signed token and point-reads a live user', async () => {
    const u = await createUser(env.DB, { email: 's@test.ca', pwHash: 'h', ip: '1' });
    const token = await issueSession(u.id, SECRET);
    const sess = await verifySession(token, SECRET, env.DB);
    expect(sess.user.id).toBe(u.id);
  });
  it('rejects a token for a deleted user (ghost-session)', async () => {
    const u = await createUser(env.DB, { email: 'ghost@test.ca', pwHash: 'h', ip: '1' });
    const token = await issueSession(u.id, SECRET);
    await env.DB.prepare('DELETE FROM users WHERE id=?').bind(u.id).run();
    expect(await verifySession(token, SECRET, env.DB)).toBeNull();
  });
  it('rejects a tampered/invalid token', async () => {
    expect(await verifySession('not.a.jwt', SECRET, env.DB)).toBeNull();
  });
  it('entitlement: active trial in future = entitled', async () => {
    const u = await createUser(env.DB, { email: 'ent@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: Date.now() + 86400000 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(true);
    expect(e.tier).toBe('trial');
  });
  it('entitlement: expired trial = not entitled', async () => {
    const u = await createUser(env.DB, { email: 'exp@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: Date.now() - 1 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(false);
  });
  // Canceled = "don't renew", not "revoke": paid access runs to period end.
  it('entitlement: canceled with future period end = still entitled', async () => {
    const u = await createUser(env.DB, { email: 'cxl-live@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'pro', status: 'canceled', periodEnd: Date.now() + 86400000 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(true);
    expect(e.status).toBe('canceled');
    expect(e.tier).toBe('pro');
  });
  it('entitlement: canceled past period end = not entitled', async () => {
    const u = await createUser(env.DB, { email: 'cxl-done@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'basic', status: 'canceled', periodEnd: Date.now() - 1 });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(false);
  });
  it('entitlement: canceled with NO period end = not entitled (no open-ended access)', async () => {
    const u = await createUser(env.DB, { email: 'cxl-null@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'pro', status: 'canceled', periodEnd: null });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(false);
  });
  it('entitlement: active with NO period end = entitled (legacy rows keep working)', async () => {
    const u = await createUser(env.DB, { email: 'act-null@test.ca', pwHash: 'h', ip: '1' });
    await upsertSubscription(env.DB, u.id, { tier: 'pro', status: 'active', periodEnd: null });
    const e = await entitlement(env.DB, u.id);
    expect(e.entitled).toBe(true);
  });
});
