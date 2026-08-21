// @ts-check
// Freshness contract for /models/.
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
// The two payloads below name the SAME INSTANT in the two shapes, so the tiles
// must render byte-identical datetime attributes. That assertion fails in any
// runner timezone if naive stamps stop being resolved in ET, and it does not
// depend on when the suite runs.
const { test, expect } = require('@playwright/test');

// 09:28 ET on a JANUARY date — deliberately EST (UTC-5), not EDT, so a parser
// that hardcodes a single offset cannot pass this by luck.
const NAIVE_ET = '2026-01-15T09:28:00';
const UTC_AWARE = '2026-01-15T14:28:00+00:00';
const SAME_INSTANT_ISO = '2026-01-15T14:28:00.000Z';

const PRO = {
  id: 'u1',
  email: 'freshness-spec@example.com',
  briefingOptIn: false,
  entitlement: { entitled: true, tier: 'pro', status: 'active' },
};

// Minimal payloads in the REAL pipeline shapes the schemas parse — the nested
// summary/expectancy/drawdown blocks generate_prediction_accuracy.py emits, not
// the flat shape an earlier mock invented (which never parsed).
const ACCURACY = {
  generated_at: NAIVE_ET,
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
};

const PREDICTION_ENGINE = {
  generated_at: UTC_AWARE,
  summary: {
    total_backtest_trades: 17422,
    tickers_tested: 63,
    date_range: '2019-01-02 → 2026-01-15',
    best_win_rate: '64.1%',
    best_avg_pnl: '0.83%',
    best_profit_factor: '1.71',
  },
};

test.describe('/models/ data freshness', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me*', (route) => route.fulfill({ json: PRO }));
    await page.route('**/api/data/**', (route) => {
      const url = route.request().url();
      const file = url.slice(url.lastIndexOf('/') + 1);
      if (file === 'accuracy.json') return route.fulfill({ json: ACCURACY });
      if (file === 'prediction-engine.json') return route.fulfill({ json: PREDICTION_ENGINE });
      // Everything else quietly unavailable — this spec is about the stamp.
      return route.fulfill({ status: 404, json: {} });
    });
  });

  test('tiles stamp their data, resolving naive ET and UTC stamps to one instant', async ({ page }) => {
    await page.goto('/models/', { waitUntil: 'domcontentloaded' });

    const tile = (name) => page.locator('section').filter({ hasText: name }).first();

    for (const [name, tileName] of [
      ['Accuracy Stats', 'Accuracy Stats'],
      ['Backtest Summary', 'Backtest Summary'],
    ]) {
      const stamp = tile(tileName).locator('time').first();
      await expect(stamp, `${name} renders a freshness stamp`).toHaveAttribute(
        'datetime',
        SAME_INSTANT_ISO,
        { timeout: 15_000 },
      );
      // The attribute is present before mount too, so only the text proves an
      // age was computed. Shape, not a pinned number: the payload keeps ageing.
      await expect(stamp, `${name} computes an age`).toHaveText(/^\d+d ago$/);
    }
  });
});
