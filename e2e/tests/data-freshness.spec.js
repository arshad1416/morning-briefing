// @ts-check
// Freshness contract for /models/ — every tile stamps its data, and the two
// stamp shapes the pipeline emits resolve to the same instant.
//
// Two regressions this pins, both of which shipped silently:
//
// 1. NO STAMP AT ALL. AccuracySchema (src/lib/schemas/market.ts) parsed
//    accuracy.json's generated_at and then dropped it in its transform, so the
//    page selling "full transparency on model performance" could not tell a
//    reader whether the numbers were from this morning or from March.
//
// 2. NAIVE STAMPS READ IN THE VIEWER'S ZONE. Published artifacts stamp
//    generated_at three ways — UTC-aware, ET-aware, and timezone-naive Pi-local
//    ET. `new Date()` resolves the naive form against the READER's zone, which
//    is four hours off for a UTC visitor and negative west of ET.
//
// The payloads below all name the SAME INSTANT, each in the shape its real file
// uses: crypto-cohorts.json and options-status.json genuinely ship naive
// Pi-local ET stamps (check them in public/data/), the rest are UTC-aware. So
// every tile must render a byte-identical datetime attribute. That fails in any
// runner timezone if naive stamps stop being resolved in ET, and it does not
// depend on when the suite runs.
const { test, expect } = require('@playwright/test');

// 09:28 ET on a JANUARY date — deliberately EST (UTC-5), not EDT, so a parser
// that hardcodes a single offset cannot pass this by luck.
const NAIVE_ET = '2026-01-15T09:28:00';
const UTC_AWARE = '2026-01-15T14:28:00+00:00';
const SAME_INSTANT_ISO = '2026-01-15T14:28:00.000Z';

// /models/ renders exactly this many tiles (MODELS_ITEMS in models-client.tsx),
// and DataFreshness is the only <time> in the whole app — so this count IS the
// per-tile coverage. A new tile landing here without a stamp fails this line.
const MODELS_TILES = 7;

const PRO = {
  id: 'u1',
  email: 'freshness-spec@example.com',
  briefingOptIn: false,
  entitlement: { entitled: true, tier: 'pro', status: 'active' },
};

// Minimal payloads in the REAL pipeline shapes the schemas parse — the nested
// summary/expectancy/drawdown blocks generate_prediction_accuracy.py emits, not
// the flat shape an earlier mock invented (which never parsed).
const PAYLOADS = {
  'accuracy.json': {
    generated_at: UTC_AWARE,
    summary: { total_trades: 412, closed_trades: 388, win_rate: 57.2 },
    expectancy: {
      expectancy_pct: 0.41,
      profit_factor: 1.32,
      kelly_fraction: 6.4,
      win_rate: 57.2,
      n_trades: 120,
      n_wins: 69,
      n_losses: 51,
    },
    drawdown: { max_drawdown_pct: 8.7 },
  },
  'prediction-engine.json': {
    generated_at: UTC_AWARE,
    summary: {
      total_backtest_trades: 17422,
      tickers_tested: 63,
      date_range: '2019-01-02 → 2026-01-15',
      best_win_rate: '64.1%',
      best_avg_pnl: '0.83%',
      best_profit_factor: '1.71',
    },
  },
  'simulation.json': {
    generated_at: UTC_AWARE,
    summary: {
      total_return: 0.084,
      sharpe: 1.12,
      max_drawdown: -0.061,
      win_rate: 0.573,
      total_trades: 388,
      avg_trade: 21.6,
    },
    strategies: [{ name: 'momentum', return: 0.09, trades: 140, win_rate: 0.58 }],
  },
  'walk_forward_v2.json': {
    generated_at: UTC_AWARE,
    summary: {
      mean_reversion: { avg_is_sharpe: 1.4, avg_oos_sharpe: 0.9, avg_degradation_pct: -35.7, total_oos_trades: 210 },
      momentum: { avg_is_sharpe: 1.1, avg_oos_sharpe: 0.8, avg_degradation_pct: -27.3, total_oos_trades: 180 },
    },
  },
  // Naive, exactly as publish_crypto_cohorts.py writes it.
  'crypto-cohorts.json': {
    generated_at: NAIVE_ET,
    source: 'test fixture',
    cohort_count: 2,
    total_equity: 20000,
    total_return_pct: 0,
    total_trades: 0,
    note: 'Simulated — not investment advice.',
    cohorts: [
      { id: 'a', name: 'Momentum', instrument: 'BTCUSDT', equity: 10000, return_pct: 0, wins: 0, losses: 0, trades: 0, win_rate: null, open: false },
      { id: 'b', name: 'Mean Reversion', instrument: 'ETHUSDT', equity: 10000, return_pct: 0, wins: 0, losses: 0, trades: 0, win_rate: null, open: true },
    ],
  },
  // Naive, exactly as publish_options_status.py writes it.
  'options-status.json': {
    generated_at: NAIVE_ET,
    vix: 14.2,
    open_count: 0,
    open_option_positions: [],
    strategies: [
      { name: 'Cash-Secured Put', kind: 'income', gate: 'VIX < 20', status: 'armed', detail: 'Regime allows entry.' },
    ],
    note: 'Simulated — not investment advice.',
  },
};

test.describe('/models/ data freshness', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me*', (route) => route.fulfill({ json: PRO }));
    // One handler for both surfaces: gated files arrive as /api/data/<file>,
    // public ones as /data/<file>, and the basename identifies either.
    await page.route('**/data/**', (route) => {
      const { pathname } = new URL(route.request().url());
      const file = pathname.slice(pathname.lastIndexOf('/') + 1);
      const payload = PAYLOADS[file];
      return payload ? route.fulfill({ json: payload }) : route.fulfill({ status: 404, json: {} });
    });
  });

  test('every tile stamps its data, resolving naive ET and UTC stamps to one instant', async ({ page }) => {
    await page.goto('/models/', { waitUntil: 'domcontentloaded' });

    const stamps = page.locator('time');
    await expect(stamps, 'every /models/ tile renders a freshness stamp').toHaveCount(MODELS_TILES, {
      timeout: 15_000,
    });

    for (let i = 0; i < MODELS_TILES; i++) {
      const stamp = stamps.nth(i);
      await expect(stamp, `stamp ${i} resolves to the shared instant`).toHaveAttribute(
        'datetime',
        SAME_INSTANT_ISO,
      );
      // The attribute is present before mount too, so only the text proves an
      // age was computed. Shape, not a pinned number: the payload keeps ageing.
      await expect(stamp, `stamp ${i} computes an age`).toHaveText(/^\d+d ago$/);
    }
  });
});
