// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Tests: Charts Page Alignment on Mobile Safari (WebKit)
 *
 * Uses Playwright route interception to mock auth + chart data APIs
 * so tests are self-contained and don't need live credentials.
 *
 * Validates the 5 fixes from commit 9933566c:
 *   1. gap fallbacks (row-gap/column-gap) for flex containers
 *   2. 400px narrow-viewport breakpoint
 *   3. requestAnimationFrame deferral (canvas non-zero clientWidth)
 *   4. -webkit-mask-image for border-radius clipping
 *   5. -webkit- flexbox prefixes on all flex containers
 *
 * Run:  npx playwright test --config=../playwright.config.js
 */

// ── Mock Data ──
// charts.js expects: { timeframes: { '1D': [{time,open,high,low,close,volume}, ...] } }
// time can be string 'YYYY-MM-DD' or object {year,month,day}
function buildMockCandles(days = 200, baseClose = 550) {
  const candles = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const volatility = baseClose * 0.02;
    const open = baseClose + Math.sin(i * 0.15) * volatility + (Math.random() - 0.5) * volatility * 0.5;
    const close = open + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * 0.3;
    candles.push({
      time: dateStr,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(40000000 + Math.random() * 60000000),
    });
  }
  return candles;
}

const MOCK_CANDLES = buildMockCandles();
const MOCK_CHART_DATA = {
  timeframes: { '1D': MOCK_CANDLES },
};

const MOCK_ME = {
  email: 'test@example.com',
  entitlement: { tier: 'pro', entitled: true },
};

// ── Helpers ──
async function setupMocks(page) {
  // Mock auth check
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ME) })
  );

  // Mock chart data API (any ticker, any timeframe)
  await page.route('**/api/data/charts/*.json**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CHART_DATA) })
  );

  // Block external 3rd-party calls to speed up tests
  await page.route('**/cdn.cloudflareinsights.com/**', (route) => route.abort());
}

async function navToCharts(page, viewportSize) {
  if (viewportSize) await page.setViewportSize(viewportSize);
  await setupMocks(page);
  await page.goto('https://briefing.arshadkazi.ca/#/charts', { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Wait for chart containers to appear
  await page.waitForSelector('#main-chart-container', { timeout: 15000 });
  // Give charts.js rAF-deferred rendering time
  await page.waitForTimeout(3000);
}

// ── Test Suite ──
test.describe('Charts page — mobile Safari alignment', () => {

  test('1: chart containers have non-zero canvas dimensions (rAF race fix)', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    const clientWidth = await page.locator('#main-chart-container').evaluate(
      (el) => el.clientWidth
    );
    expect(clientWidth).toBeGreaterThan(0);
  });

  test('2: charts-header and charts-controls do not overlap', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    const header = await page.locator('.charts-header').boundingBox();
    const controls = await page.locator('.charts-controls').boundingBox();
    const mainChart = await page.locator('#main-chart-container').boundingBox();

    expect(header).not.toBeNull();
    expect(controls).not.toBeNull();
    expect(mainChart).not.toBeNull();

    // Controls must be inside the header vertically
    expect(controls.y).toBeGreaterThanOrEqual(header.y - 1);
    expect(controls.y + controls.height).toBeLessThanOrEqual(header.y + header.height + 2);

    // Main chart starts after the header
    expect(mainChart.y).toBeGreaterThanOrEqual(header.y + header.height - 5);
  });

  test('3: chart-card has -webkit-mask-image applied', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    const hasMask = await page.locator('.chart-card').first().evaluate((el) => {
      const s = window.getComputedStyle(el);
      return s.webkitMaskImage !== 'none' && s.webkitMaskImage !== '';
    });
    expect(hasMask).toBe(true);
  });

  test('4: flex containers resolve to flex display (WebKit prefixes)', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    const display = await page.locator('.charts-header').evaluate(
      (el) => window.getComputedStyle(el).display
    );
    expect(display).toMatch(/flex/);
  });

  test('5: ticker dropdown opens within viewport bounds', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    // Open the dropdown
    await page.locator('.ticker-selector-wrapper input').click();
    await page.waitForTimeout(400);

    const dropdown = await page.locator('.ticker-dropdown').boundingBox();
    if (dropdown) {
      const vp = page.viewportSize();
      expect(dropdown.x).toBeGreaterThanOrEqual(0);
      expect(dropdown.y).toBeGreaterThanOrEqual(0);
      expect(dropdown.x + dropdown.width).toBeLessThanOrEqual(vp.width + 2);
    }
  });

  test('6: flex children have visible gap (gap fallback validation)', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    // .charts-header has two children: h2 + .charts-controls
    const children = page.locator('.charts-header > *');
    const count = await children.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const first = await children.nth(0).boundingBox();
    const second = await children.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // At 390px (below 768px breakpoint), header uses flex-direction: column
    // So gap is vertical — second should be below first, not overlapping
    const flexDir = await page.locator('.charts-header').evaluate(
      (el) => window.getComputedStyle(el).flexDirection
    );

    if (flexDir === 'column') {
      // Vertical gap: second.y should be >= first.y + first.height
      const verticalGap = second.y - (first.y + first.height);
      expect(verticalGap).toBeGreaterThanOrEqual(6);
    } else {
      // Horizontal gap
      const horizontalGap = second.x - (first.x + first.width);
      expect(horizontalGap).toBeGreaterThanOrEqual(6);
    }
  });

  test('7: chart legend items are spaced apart (no overlapping)', async ({ page }) => {
    await navToCharts(page, { width: 390, height: 844 });

    // Legends appear after data loads — wait for them
    await page.waitForSelector('.chart-legend-item', { timeout: 5000 });
    const items = page.locator('.chart-legend-item');
    const count = await items.count();
    if (count >= 2) {
      const a = await items.nth(0).boundingBox();
      const b = await items.nth(1).boundingBox();
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      // Should not overlap
      const overlaps =
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      expect(overlaps).toBe(false);
    }
  });
});

test.describe('Charts page — 400px narrow-viewport breakpoint', () => {

  test('8: at 401px (above breakpoint), controls use row layout', async ({ page }) => {
    await navToCharts(page, { width: 401, height: 844 });

    const flexDir = await page.locator('.charts-controls').evaluate(
      (el) => window.getComputedStyle(el).flexDirection
    );
    expect(flexDir).toBe('row');
  });

  test('9: at 380px, controls stack vertically', async ({ page }) => {
    await navToCharts(page, { width: 380, height: 667 });

    const flexDir = await page.locator('.charts-controls').evaluate(
      (el) => window.getComputedStyle(el).flexDirection
    );
    expect(flexDir).toBe('column');
  });

  test('10: at 380px, ticker selector is full-width', async ({ page }) => {
    await navToCharts(page, { width: 380, height: 667 });

    const childWidth = await page.locator('.ticker-selector-wrapper').evaluate(
      (el) => el.clientWidth
    );
    const parentWidth = await page.locator('.ticker-selector-wrapper').evaluate(
      (el) => el.parentElement.clientWidth
    );
    expect(childWidth).toBeGreaterThanOrEqual(parentWidth - 20);
  });

  test('11: at 380px, timeframe-group is centered', async ({ page }) => {
    await navToCharts(page, { width: 380, height: 667 });

    const jc = await page.locator('.timeframe-group').evaluate(
      (el) => window.getComputedStyle(el).justifyContent
    );
    expect(jc).toBe('center');
  });

  test('12: at 380px, header has reduced padding', async ({ page }) => {
    await navToCharts(page, { width: 380, height: 667 });

    const padding = await page.locator('.charts-header').evaluate(
      (el) => window.getComputedStyle(el).paddingLeft
    );
    // Should be around 10-12px (not the default 16px)
    const px = parseInt(padding, 10);
    expect(px).toBeLessThanOrEqual(12);
  });
});
