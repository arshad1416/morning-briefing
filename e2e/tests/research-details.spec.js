// @ts-check
const { test, expect } = require('@playwright/test');

const ANALYSIS = {
  generated_at: '2026-07-22T12:00:00Z',
  analysis_ideas: [
    {
      type: 'BULLISH_CONVERGENCE',
      tickers: ['META'],
      signal: 'Positive news sentiment and heavy call buying are aligned.',
      action: 'Consider a bullish bias',
    },
  ],
  market_overview: { top_headlines: [] },
};

const MAPLEGAMMA_ANALYSIS = {
  meta: {
    generated_at: '2026-07-22T12:00:00Z',
    market_regime: 'risk-on',
    confidence: 8,
    model: 'test-model',
  },
  market_pulse: {
    one_liner: 'Breadth is improving while technology leadership remains intact.',
    sentiment_score: 7,
    sector_rotation: 'Capital is rotating toward growth and semiconductors.',
    key_levels: { SPY: { support: 625, resistance: 632 } },
  },
  position_review: [
    {
      action: 'HOLD',
      ticker: 'MSFT',
      asset_class: 'stock',
      target: 540,
      stop: 485,
      risk_reward: 2.1,
      rationale: 'The trend and earnings thesis remain intact.',
    },
  ],
  opportunities: [
    {
      direction: 'LONG',
      ticker: 'AAPL',
      conviction: 'high',
      timeframe: '2–4 weeks',
      thesis: 'A breakout could attract follow-through buying.',
      entry_zone: [228, 231],
      target: 245,
      stop: 222,
      catalyst: 'Earnings revisions are improving.',
    },
  ],
  risk_alerts: [
    {
      severity: 'high',
      alert: 'Volatility is rising into a major macro release.',
      affected_positions: ['MSFT', 'AAPL'],
      trigger: 'VIX above 22',
      mitigation: 'Review stops and reduce oversized exposure before the release.',
    },
  ],
};

async function installResearchMocks(page) {
  await page.route('**/api/auth/me*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'research-test-user',
        email: 'research@example.com',
        entitlement: { entitled: true, tier: 'pro', status: 'active' },
      }),
    }),
  );
  await page.route('**/data/analysis.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANALYSIS) }),
  );
  await page.route('**/api/data/morning_analysis.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MAPLEGAMMA_ANALYSIS) }),
  );
  await page.route('**/*cloudflareinsights.com/**', (route) => route.abort());
  await page.route('**/*google-analytics.com/**', (route) => route.abort());
}

test.describe('research analysis details', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'One browser covers the interaction contract.');
    await installResearchMocks(page);
    await page.goto('/research/', { waitUntil: 'domcontentloaded' });
  });

  test('an Analysis Idea opens an explanatory, keyboard-dismissible dialog', async ({ page }) => {
    await page.getByRole('tab', { name: 'Ideas' }).click();
    const trigger = page.getByRole('button', { name: 'Open analysis details for META' });
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'META · Several signals agree — upward' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Why it surfaced' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'What to check before trusting it' })).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Market Pulse, opportunities, risks and positions each open tailored details', async ({ page }) => {
    await page.getByRole('tab', { name: 'MapleGamma Analysis' }).click();

    const cases = [
      { trigger: 'Open Market Pulse analysis details', title: 'Market Pulse', section: 'How to read this' },
      { trigger: 'Open position review details for MSFT', title: 'MSFT · HOLD', section: 'What the instruction means' },
      { trigger: 'Open opportunity details for AAPL', title: 'AAPL · LONG', section: 'The plan at a glance' },
      { trigger: 'Open risk alert details: Volatility is rising into a major macro release.', title: 'Volatility is rising into a major macro release.', section: 'Suggested response' },
    ];

    for (const item of cases) {
      await page.getByRole('button', { name: item.trigger }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: item.title })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: item.section })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close analysis details' }).click();
      await expect(dialog).toBeHidden();
    }
  });
});
