import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
import { createUser, getUserById } from '../src/db.js';
import { GLOBAL_PER_DAY } from '../src/briefing.js';

beforeAll(async () => {
  await migrate();
  env.BRIEFING_UNSUB_SECRET = 'test-unsub-secret';
  env.SESSION_SECRET = 'test-secret'; // the no-collision test drives a real signup
});

// Mirrors the Pi sender's token format exactly: "<user_id>.<hmacHex(secret,user_id)>".
async function token(userId, secret = env.BRIEFING_UNSUB_SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${userId}.${hex}`;
}

const subscribe = (email, ip = '203.0.113.9', consent = true) => app.request('/api/briefing/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
  body: JSON.stringify({ email, consent }),
}, env);

const row = (email) => env.DB.prepare('SELECT * FROM briefing_subscribers WHERE email=?').bind(email).first();

describe('briefing subscribe (logged-out capture)', () => {
  it('refuses to record a subscriber who did not affirm consent (CASL)', async () => {
    const res = await subscribe('nocheck@test.ca', '203.0.113.9', false);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'consent_required' });
    expect(await row('nocheck@test.ca')).toBe(null);
  });

  it('stores the capture with CASL consent evidence and never touches users', async () => {
    const res = await subscribe('capture@test.ca');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const r = await row('capture@test.ca');
    expect(r.id).toBeTruthy();
    expect(r.created_at).toBeGreaterThan(0);
    expect(r.consent_ip).toBe('203.0.113.9');
    // Same evidence insertConsent() records for the two account signup paths.
    expect(r.terms_version).toBe(env.TERMS_VERSION);
    expect(r.ack_version).toBe(env.ACK_VERSION);
    expect(r.unsubscribed_at).toBe(null);

    // THE LANDMINE: a capture must not create a users row. A pw_hash-NULL row
    // there returns 409 email_taken from auth_password.js:34 (proven against
    // this tree) and is linkable onto the victim's Google account by
    // auth_oauth.js:85, skipping the consent gate.
    expect(await env.DB.prepare('SELECT COUNT(*) n FROM users WHERE email=?').bind('capture@test.ca').first())
      .toEqual({ n: 0 });
  });

  it('a captured address can still sign up for a real account (no collision)', async () => {
    expect((await subscribe('signup-later@test.ca')).status).toBe(200);
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'signup-later@test.ca', password: 'correct-horse-battery',
        acceptTerms: true, acceptAck: true, notQuebec: true,
      }),
    }, env);
    expect(res.status).toBe(200); // 409 email_taken would mean the capture squatted the address
  });

  it('re-submitting is not an error and does not overwrite or leak', async () => {
    expect((await subscribe('dupe@test.ca')).status).toBe(200);
    const first = await row('dupe@test.ca');
    const second = await subscribe('dupe@test.ca');
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true }); // byte-identical to the first response
    expect((await row('dupe@test.ca')).id).toBe(first.id);
    expect(await env.DB.prepare('SELECT COUNT(*) n FROM briefing_subscribers').first()).toEqual({ n: 1 });
  });

  it('rejects a malformed address', async () => {
    for (const bad of ['', 'nope', 'a@b', 'two words@test.ca']) {
      const res = await subscribe(bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_email');
    }
    expect(await env.DB.prepare('SELECT COUNT(*) n FROM briefing_subscribers').first()).toEqual({ n: 0 });
  });

  it('rate-limits a single IP and leaves another IP unaffected', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await subscribe(`flood${i}@test.ca`, '198.51.100.1')).status).toBe(200);
    }
    const blocked = await subscribe('flood5@test.ca', '198.51.100.1');
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('too_many_requests');
    expect(await row('flood5@test.ca')).toBe(null); // the 6th was never written
    // Per-IP window only — a different address is still served.
    expect((await subscribe('other-ip@test.ca', '198.51.100.2')).status).toBe(200);
  });

  it('a blocked IP does not spend the global daily budget', async () => {
    // 10 requests from one address: 5 accepted, 5 rejected. If the global
    // counter were bumped unconditionally, one scripted IP could burn the
    // site-wide ceiling and 429 everyone else for the rest of the day.
    for (let i = 0; i < 10; i += 1) await subscribe(`burn${i}@test.ca`, '198.51.100.9');
    const g = await env.DB.prepare("SELECT count FROM chat_rate WHERE ip='@global'").first();
    expect(g.count).toBe(5);
  });

  it('rate-limits globally once the daily ceiling is passed, across IPs', async () => {
    // Seed the '@global' sentinel counter to its ceiling instead of issuing that
    // many requests. Sentinel key can never collide with a real IP. Read from the
    // source constant so raising the ceiling cannot silently defang this test.
    const day = Math.floor(Date.now() / 86400000) * 86400000;
    await env.DB.prepare('INSERT INTO chat_rate (ip, window_start, count) VALUES (?,?,?)')
      .bind('@global', day, GLOBAL_PER_DAY).run();
    const res = await subscribe('spike@test.ca', '192.0.2.77'); // fresh IP, under its own limit
    expect(res.status).toBe(429);
    expect(await row('spike@test.ca')).toBe(null);
  });
});

describe('briefing unsubscribe', () => {
  it('GET does NOT write — it returns a confirmation page with a POST form', async () => {
    const u = await createUser(env.DB, { email: 'unsub@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(1);
    const res = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id)}`, {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    // A link scanner / Outlook Safe Links fetching this URL must change nothing.
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(1);
    expect(html).toContain('Nothing has changed yet');
    // No action attribute → the form POSTs back to this same URL with ?t= intact.
    expect(html).toContain('<form method="post">');
    expect(html).not.toContain('action=');
  });

  it('one-click POST (RFC 8058) unsubscribes', async () => {
    const u = await createUser(env.DB, { email: 'unsub2@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    const res = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id)}`, { method: 'POST' }, env);
    expect(res.status).toBe(200);
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(0);
  });

  it('the confirmation form submission (urlencoded, empty body) unsubscribes', async () => {
    const u = await createUser(env.DB, { email: 'unsub4@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    const res = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: '',
    }, env);
    expect(res.status).toBe(200);
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(0);
  });

  it('unsubscribes a landing-page capture, and the unsubscribe sticks', async () => {
    await subscribe('bye@test.ca');
    const { id } = await row('bye@test.ca');
    const t = await token(id);

    expect((await app.request(`/api/briefing/unsubscribe?t=${t}`, {}, env)).status).toBe(200);
    expect((await row('bye@test.ca')).unsubscribed_at).toBe(null); // GET still writes nothing

    expect((await app.request(`/api/briefing/unsubscribe?t=${t}`, { method: 'POST' }, env)).status).toBe(200);
    expect((await row('bye@test.ca')).unsubscribed_at).toBeGreaterThan(0);

    // Re-submitting the address must NOT resurrect them (INSERT OR IGNORE).
    expect((await subscribe('bye@test.ca')).status).toBe(200);
    expect((await row('bye@test.ca')).unsubscribed_at).toBeGreaterThan(0);
  });

  it('rejects a forged token and a wrong-secret token without changing state', async () => {
    const u = await createUser(env.DB, { email: 'unsub3@test.ca', pwHash: 'x', ip: null, briefingOptIn: true });
    const forged = await app.request(`/api/briefing/unsubscribe?t=${u.id}.deadbeef`, {}, env);
    expect(forged.status).toBe(400);
    const wrongSecret = await app.request(`/api/briefing/unsubscribe?t=${await token(u.id, 'not-the-secret')}`, {}, env);
    expect(wrongSecret.status).toBe(400);
    const noToken = await app.request('/api/briefing/unsubscribe', {}, env);
    expect(noToken.status).toBe(400);
    const forgedPost = await app.request(`/api/briefing/unsubscribe?t=${u.id}.deadbeef`, { method: 'POST' }, env);
    expect(forgedPost.status).toBe(400);
    expect((await getUserById(env.DB, u.id)).briefing_opt_in).toBe(1); // never flipped
  });
});
