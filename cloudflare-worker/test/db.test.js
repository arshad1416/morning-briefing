import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getUserById, getUserByEmail, getSubscription, upsertSubscription } from '../src/db.js';

beforeAll(() => migrate());

describe('db', () => {
  it('creates and reads a user by id and email', async () => {
    const u = await createUser(env.DB, { email: 'a@test.ca', pwHash: 'h', ip: '1.1.1.1' });
    expect(u.id).toBeTruthy();
    expect((await getUserById(env.DB, u.id)).email).toBe('a@test.ca');
    expect((await getUserByEmail(env.DB, 'a@test.ca')).id).toBe(u.id);
  });
  it('upserts and reads a subscription', async () => {
    const u = await createUser(env.DB, { email: 'b@test.ca', pwHash: null, ip: '1.1.1.1' });
    await upsertSubscription(env.DB, u.id, { tier: 'trial', status: 'active', trialEndsAt: 999 });
    const s = await getSubscription(env.DB, u.id);
    expect(s.tier).toBe('trial');
    expect(s.trial_ends_at).toBe(999);
  });
});
