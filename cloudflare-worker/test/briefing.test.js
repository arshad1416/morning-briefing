import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getUserById } from '../src/db.js';

beforeAll(async () => { await migrate(); env.BRIEFING_UNSUB_SECRET = 'test-unsub-secret'; });

// Mirrors the Pi sender's token format exactly: "<user_id>.<hmacHex(secret,user_id)>".
async function token(userId, secret = env.BRIEFING_UNSUB_SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${userId}.${hex}`;
}

describe('briefing unsubscribe', () => {
  it('valid GET token flips briefing_opt_in to 0 and shows a confirmation page', async () => {
    const u = await createUser(env.DB, { email: 'unsub@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(1);
    const res = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id)}`, {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(0);
  });

  it('one-click POST (RFC 8058) unsubscribes', async () => {
    const u = await createUser(env.DB, { email: 'unsub2@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    const res = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id)}`, { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(0);
  });

  it('rejects a forged token and a wrong-secret token without changing state', async () => {
    const u = await createUser(env.DB, { email: 'unsub3@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    const forged = await app.request(`/api/briefing/unsubscribe?t=${u.id}.deadbeef`, {}, env);
    expect(forged.status).toBe(400);
    const wrongSecret = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id, 'not-the-secret')}`, {}, env);
    expect(wrongSecret.status).toBe(400);
    const noToken = await app.request('/api/briefing/unsubscribe', {}, env);
    expect(noToken.status).toBe(400);
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(1); // never flipped
  });
});
