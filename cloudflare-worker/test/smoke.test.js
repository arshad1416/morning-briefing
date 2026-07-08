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
});
