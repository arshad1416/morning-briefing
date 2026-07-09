import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { env } from 'cloudflare:test';
import { migrate } from './helpers.js';
beforeAll(() => migrate());
afterEach(() => vi.restoreAllMocks());
describe('smoke', () => {
  it('health returns ok', async () => {
    const res = await app.request('/api/health', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('/feedback route is mounted (invalid body -> 400, not a 404 route-miss)', async () => {
    // Stub fetch so this can never reach Telegram, even if the handler advances.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const res = await app.request(
      '/feedback',
      { method: 'POST', body: 'not-json' },
      env,
    );
    expect(res.status).not.toBe(404); // proves the POST /feedback route exists
    expect(res.status).toBe(400); // invalid JSON body rejected before any network call
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('OPTIONS /chat preflight returns 204 with CORS header', async () => {
    // The live frontend (briefing.arshadkazi.ca) hits the workers.dev origin
    // cross-origin, so the browser sends an OPTIONS preflight to /chat. The
    // global CORS middleware must answer it, not 404.
    const res = await app.request(
      '/chat',
      { method: 'OPTIONS', headers: { Origin: 'https://briefing.arshadkazi.ca' } },
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://briefing.arshadkazi.ca');
  });

  it('POST / reaches the chat handler (not a 404 route-miss)', async () => {
    // The live chat.js POSTs to the Worker ROOT path. Stub fetch so we never
    // hit OpenRouter/yfinance; we only prove the route is mounted (non-404).
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const res = await app.request(
      '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://briefing.arshadkazi.ca' },
        body: JSON.stringify({ ticker: 'AAPL' }),
      },
      env,
    );
    expect(res.status).not.toBe(404); // proves the POST / chat route exists
    fetchSpy.mockRestore();
  });
});
