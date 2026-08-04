import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import app from '../src/index.js';
import { resetLiveCacheForTests } from '../src/live_latest.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const STATIC_JSON = {
  generated_at: '2026-08-04T16:09:52-04:00',
  market_summary: {
    vix: 16.44,
    ten_year_yield: 4.63,
    indices: [
      { ticker: 'S&P 500', price: 7736.52, change_pct: 1.79 },
      { ticker: 'Dow Jones', price: 54085.88, change_pct: 1.71 },
      { ticker: 'NASDAQ', price: 26584.99, change_pct: 2.59 },
      { ticker: 'Russell 2000', price: 3039.75, change_pct: 1.94 },
      { ticker: 'TSX', price: 35801.59, change_pct: 1.63 },
      { ticker: 'VIX', price: 16.44, change_pct: 3.66 },
      { ticker: '10Y Yield', price: 4.63, change_pct: -1.28 },
    ],
    fx_rates: [{ pair: 'USD/CAD', price: 1.3812 }],
  },
  narrative: { summary_paragraph: '📊 **Market Snapshot**' },
  central_banks: { fed: '', boc: '' },
  market_news: { headlines: [], earnings: [], analyst_ratings: [] },
  geopolitical: [],
  congress: { trades: [] },
  premarket_top_setups: [],
};

const YAHOO_SYMBOLS = {
  '^GSPC': [7600, 7700, 7800],   // live 7800, +1.30%
  '^DJI': [53000, 53500, 54000], // live 54000, +0.93%
  '^IXIC': [25000, 25800, 26600],
  '^RUT': [2900, 2950, 3050],    // live 3050, +3.39%
  '^GSPTSE': [35000, 35200, 35400],
  '^VIX': [15, 16, 15.5],
  '^TNX': [4.6, 4.65, 4.7],
  'USDCAD=X': [1.37, 1.38, 1.39],
};

function makeChart(closes) {
  return {
    chart: { result: [{ indicators: { quote: [{ close: closes }] } }] },
  };
}

function makeFetchMock({ failSymbols = [], failStatic = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url) => {
    calls.push(url);
    const u = String(url);
    if (u.startsWith('https://maplegamma.com/data/latest.json')) {
      if (failStatic) return new Response('boom', { status: 503 });
      return new Response(JSON.stringify(STATIC_JSON), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.startsWith('https://query1.finance.yahoo.com')) {
      const symbol = decodeURIComponent(new URL(u).pathname.split('/').pop());
      if (failSymbols.includes(symbol)) return new Response('throttled', { status: 429 });
      return new Response(JSON.stringify(makeChart(YAHOO_SYMBOLS[symbol])), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('unexpected url', { status: 404 });
  });
  return { fn, calls };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/latest', () => {
  let mock;

  beforeEach(() => {
    resetLiveCacheForTests();
    mock = makeFetchMock();
    vi.stubGlobal('fetch', mock.fn);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('overlays fresh Yahoo quotes onto the static snapshot', async () => {
    const res = await app.request('/api/latest', {}, {});
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.generated_at).toBe(STATIC_JSON.generated_at); // static parts untouched
    expect(data.live_refreshed_at).toBeTruthy();

    const byTicker = Object.fromEntries(data.market_summary.indices.map((i) => [i.ticker, i]));
    // Russell 2000 came from Yahoo (3050, +3.39%), not the static 3039.75
    expect(byTicker['Russell 2000'].price).toBe(3050);
    expect(byTicker['Russell 2000'].change_pct).toBeCloseTo(3.39, 1);
    expect(byTicker['S&P 500'].price).toBe(7800);
    // VIX + 10Y both land in the strip AND the dedicated fields
    expect(data.market_summary.vix).toBe(15.5);
    expect(data.market_summary.ten_year_yield).toBeCloseTo(4.7, 1);
    expect(data.market_summary.fx_rates[0].price).toBeCloseTo(1.39, 2);
  });

  it('keeps static values for symbols whose Yahoo fetch failed', async () => {
    mock = makeFetchMock({ failSymbols: ['^TNX', '^RUT'] });
    vi.stubGlobal('fetch', mock.fn);

    const res = await app.request('/api/latest', {}, {});
    expect(res.status).toBe(200);
    const data = await res.json();

    const byTicker = Object.fromEntries(data.market_summary.indices.map((i) => [i.ticker, i]));
    expect(byTicker['10Y Yield'].price).toBe(4.63); // static fallback
    expect(byTicker['Russell 2000'].price).toBe(3039.75); // static fallback
    expect(byTicker['S&P 500'].price).toBe(7800); // live where it worked
    expect(data.market_summary.ten_year_yield).toBe(4.63); // dedicated field untouched
    expect(data.live_refreshed_at).toBeTruthy(); // partial overlay is still a refresh
  });

  it('degrades to the plain static snapshot when every Yahoo fetch fails', async () => {
    mock = makeFetchMock({ failSymbols: Object.keys(YAHOO_SYMBOLS) });
    vi.stubGlobal('fetch', mock.fn);

    const res = await app.request('/api/latest', {}, {});
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.live_refreshed_at).toBeUndefined();
    expect(data.market_summary.indices[0].price).toBe(7736.52);
  });

  it('returns 502 when the static snapshot itself is unreachable', async () => {
    mock = makeFetchMock({ failStatic: true });
    vi.stubGlobal('fetch', mock.fn);

    const res = await app.request('/api/latest', {}, {});
    expect(res.status).toBe(502);
  });

  it('serves the cached payload without touching upstreams within the TTL', async () => {
    await app.request('/api/latest', {}, {});
    const afterFirst = mock.calls.length; // 1 static + 8 yahoo
    expect(afterFirst).toBe(9);

    const res2 = await app.request('/api/latest', {}, {});
    expect(res2.status).toBe(200);
    expect(mock.calls.length).toBe(afterFirst); // zero new upstream calls
  });

  it('re-fetches after the cache is reset (TTL expiry path)', async () => {
    await app.request('/api/latest', {}, {});
    resetLiveCacheForTests();
    const res = await app.request('/api/latest', {}, {});
    expect(res.status).toBe(200);
    expect(mock.calls.length).toBe(18); // fresh round of upstream fetches
  });
});
