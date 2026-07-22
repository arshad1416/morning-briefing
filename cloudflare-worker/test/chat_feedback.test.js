// Tests for the chat rate limiter, the R2-backed IBKR position disclosure,
// the durable feedback table, and the passkey ROR endpoint (2026-07 audit fixes).
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';

beforeAll(async () => {
  await migrate();
  Object.assign(env, {
    SESSION_SECRET: 'test-secret',
    OPENROUTER_API_KEY: 'or-test',
    RATE_LIMIT_PER_MIN: 10,
    TELEGRAM_BOT_TOKEN: 'tg-tok',
    TELEGRAM_HOME_CHANNEL: '123',
  });
});
afterEach(() => { vi.restoreAllMocks(); });

// Any outbound fetch (yahoo chart, OpenRouter, Telegram) gets a happy mock.
function mockOutbound() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('openrouter')) {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Analysis.' } }], model: 'm' }), { status: 200 });
    }
    if (u.includes('finance.yahoo.com')) {
      return new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 100, regularMarketVolume: 1e6 }, indicators: { quote: [{ close: [99, 100] }] } }] } }), { status: 200 });
    }
    return new Response('{"ok":true}', { status: 200 });
  });
}

const chat = (ip) => app.request('/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
  body: JSON.stringify({ ticker: 'AAPL' }),
}, env);

describe('chat rate limit', () => {
  it('enforces RATE_LIMIT_PER_MIN per IP with 429s, per-IP isolated', async () => {
    mockOutbound();
    for (let i = 0; i < 10; i++) {
      expect((await chat('1.2.3.4')).status).toBe(200);
    }
    const over = await chat('1.2.3.4');
    expect(over.status).toBe(429);
    expect((await over.json()).error).toBe('rate_limited');
    // A different IP is unaffected.
    expect((await chat('5.6.7.8')).status).toBe(200);
  });
});

describe('IBKR position disclosure (R2)', () => {
  it('appends the disclosure when the enveloped R2 file holds the ticker', async () => {
    mockOutbound();
    await env.PRIVATE.put('ibkr_positions.json', JSON.stringify({
      timestamp: 't', version: 1, data: [{ ticker: 'AAPL', quantity: 5 }],
    }));
    const res = await chat('2.2.2.2');
    expect(res.status).toBe(200);
    expect((await res.json()).content).toContain('Position disclosure');
  });

  it('omits the disclosure when the ticker is not held or the file is absent', async () => {
    mockOutbound();
    await env.PRIVATE.put('ibkr_positions.json', JSON.stringify({ data: [{ ticker: 'MSFT' }] }));
    const held = await chat('3.3.3.3');
    expect((await held.json()).content).not.toContain('Position disclosure');
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
