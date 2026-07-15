import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getSubscription } from '../src/db.js';
import { startTrial, TRIAL_MS } from '../src/trial.js';

beforeAll(() => migrate());

describe('trial', () => {
  it('starts a 7-day trial and records the claim', async () => {
    expect(TRIAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    const u = await createUser(env.DB, { email: 't1@test.ca', pwHash: 'h', ip: '9.9.9.9' });
    const r = await startTrial(env.DB, { userId: u.id, deviceId: 'devA', ip: '9.9.9.9' });
    expect(r.ok).toBe(true);
    const sub = await getSubscription(env.DB, u.id);
    expect(sub.tier).toBe('trial');
    expect(sub.trial_ends_at).toBeGreaterThan(Date.now() + TRIAL_MS - 5000);
  });
  it('refuses a second trial from the same device', async () => {
    // Self-contained: seed the device's first claim, then attempt a duplicate —
    // both within this test. The vitest-pool-workers harness (isolatedStorage,
    // default true) rolls back writes made inside a prior `it`, so this cannot
    // rely on the first test's claim persisting across tests.
    const u2 = await createUser(env.DB, { email: 't2@test.ca', pwHash: 'h', ip: '8.8.8.8' });
    await startTrial(env.DB, { userId: u2.id, deviceId: 'devB', ip: '8.8.8.8' });
    const u3 = await createUser(env.DB, { email: 't3@test.ca', pwHash: 'h', ip: '8.8.8.8' });
    const r = await startTrial(env.DB, { userId: u3.id, deviceId: 'devB', ip: '8.8.8.8' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('trial_already_claimed');
  });
});
