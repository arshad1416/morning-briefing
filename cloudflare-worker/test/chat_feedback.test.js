// Tests for the removed chat endpoint, the durable feedback table, and the
// passkey ROR endpoint (2026-07 audit fixes).
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';

beforeAll(async () => {
  await migrate();
  Object.assign(env, {
    SESSION_SECRET: 'test-secret',
    TELEGRAM_BOT_TOKEN: 'tg-tok',
    TELEGRAM_HOME_CHANNEL: '123',
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('chat endpoint removed', () => {
  it('POST / and POST /chat 404 — the unauthenticated OpenRouter path is gone', async () => {
    for (const path of ['/', '/chat']) {
      const res = await app.request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticker: 'AAPL' }),
      }, env);
      expect(res.status).toBe(404);
    }
  });
});

describe('feedback durable store', () => {
  it('persists a row in the feedback table (the table now exists via migration)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 })); // Telegram
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '4.4.4.4' },
      body: JSON.stringify({ type: 'bug', message: 'The chart is upside down', page: '/options' }),
    }, env);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT * FROM feedback WHERE message LIKE 'The chart%'").first();
    expect(row).toBeTruthy();
    expect(row.type).toBe('bug');
    expect(row.status).toBe('new');
  });
});

describe('passkey Related Origin Requests', () => {
  it('serves the ROR document at /.well-known/webauthn', async () => {
    const res = await app.request('/.well-known/webauthn', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.origins).toContain('https://maplegamma.com');
    expect(body.origins).toContain('https://www.maplegamma.ca');
  });
});
