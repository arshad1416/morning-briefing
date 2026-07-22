// @ts-check
// Tier-gating UX matrix. The static export has no real Worker behind it, so
// /api/auth/me and /api/data/* are mocked per test to simulate each tier:
// signed-out, trial-active, basic, expired/none, and pro. Server gating itself
// lives in cloudflare-worker/ and is out of scope here — these tests assert
// the client renders the right conversion affordance for each server answer.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// Synthetic fixture in the raw pipeline shape — GexDataSchema parses it
// directly. (The real gex-detail.json is Pro-tier R2 data and is deliberately
// not committed to the repo.)
const GEX_DETAIL = JSON.parse(
  readFileSync(path.resolve(__dirname, '../fixtures/gex-detail.fixture.json'), 'utf8'),
);

const IN_5_DAYS = Date.now() + 5 * 86_400_000;

const ME = {
  trial: {
    id: 'u1',
    email: 'gating-spec@example.com',
    briefingOptIn: false,
    entitlement: { entitled: true, tier: 'trial', status: 'active', trialEndsAt: IN_5_DAYS },
  },
  basic: {
    id: 'u1',
    email: 'gating-spec@example.com',
    briefingOptIn: false,
    entitlement: { entitled: true, tier: 'basic', status: 'active' },
  },
  pro: {
    id: 'u1',
    email: 'gating-spec@example.com',
    briefingOptIn: false,
    entitlement: { entitled: true, tier: 'pro', status: 'active' },
  },
  none: {
    id: 'u1',
    email: 'gating-spec@example.com',
    briefingOptIn: false,
    entitlement: { entitled: false, tier: null, status: 'none' },
  },
};

/** @param {import('@playwright/test').Page} page */
async function mockAuth(page, me) {
  await page.route('**/api/auth/me', (route) =>
    me
      ? route.fulfill({ json: me })
      : route.fulfill({ status: 401, json: { error: 'unauthorized' } }),
  );
}

/**
 * Mock the Worker data gate. `grant: true` serves the gex-detail fixture (other
 * premium files 404 -> quiet unavailable states); otherwise every gated fetch
 * gets the given status.
 * @param {import('@playwright/test').Page} page
 */
async function mockGated(page, { grant = false, status = 401, need } = {}, counters = {}) {
  await page.route('**/api/data/**', (route) => {
    const url = route.request().url();
    const file = url.slice(url.lastIndexOf('/') + 1);
    counters[file] = (counters[file] ?? 0) + 1;
    if (grant) {
      if (file === 'gex-detail.json') return route.fulfill({ json: GEX_DETAIL });
      return route.fulfill({ status: 404, json: {} });
    }
    return route.fulfill({
      status,
      json: status === 403 ? { error: 'upgrade_required', ...(need ? { need } : {}) } : { error: 'unauthorized' },
    });
  });
}

test.describe('signed-out visitor', () => {
  test('dashboard portfolio tile pitches the trial, no card required', async ({ page }) => {
    await mockAuth(page, null);
    await mockGated(page, { status: 401 });
    await page.goto('/dashboard/');
    await expect(page.getByText('7-day free trial').first()).toBeVisible();
    const cta = page.getByRole('link', { name: 'Start free trial' }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/signup/');
    await expect(page.getByText('no card required').first()).toBeVisible();
  });

  test('options page gates flow table and gamma wall with trial CTAs', async ({ page }) => {
    await mockAuth(page, null);
    await mockGated(page, { status: 401 });
    await page.goto('/options/');
    // GateCard (flow table) signin variant
    await expect(page.getByRole('link', { name: 'Start free trial' }).first()).toBeVisible();
    // FeatureGate overlays (nope + gamma walls) signin variant
    await expect(page.getByRole('link', { name: 'Start 7-day free trial' }).first()).toBeVisible();
    await expect(page.getByText('No card required').first()).toBeVisible();
  });
});

test.describe('trial-active user', () => {
  test('sees no gates and a header trial chip', async ({ page }) => {
    await mockAuth(page, ME.trial);
    await mockGated(page, { grant: true });
    await page.goto('/options/');
    // Chart unlocked — no cosmetic overlays.
    await expect(page.getByText('Included with MapleGamma')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /Gamma profile for/ })).toBeVisible();

    const vw = page.viewportSize()?.width ?? 1280;
    test.skip(vw < 640, 'trial chip is hidden below the sm breakpoint');
    const chip = page.getByRole('link', { name: /Trial · 5 days left/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('href', '/account/');
  });
});

test.describe('basic (under-tier) user', () => {
  test('pro features upsell to /account/ and never promise a second trial', async ({ page }) => {
    await mockAuth(page, ME.basic);
    await mockGated(page, { status: 403, need: 'pro' });
    await page.goto('/options/');
    const upgrade = page.getByRole('link', { name: 'Upgrade to Pro' }).first();
    await expect(upgrade).toBeVisible();
    await expect(upgrade).toHaveAttribute('href', '/account/');
    await expect(page.getByRole('link', { name: 'Start 7-day free trial' })).toHaveCount(0);
  });

  test('a 403 halts gated polling and retries entirely', async ({ page }) => {
    const counters = {};
    await mockAuth(page, ME.basic);
    await mockGated(page, { status: 403, need: 'pro' }, counters);
    await page.goto('/options/');
    await expect(page.getByRole('link', { name: 'Upgrade to Pro' }).first()).toBeVisible();
    await page.waitForTimeout(3000);
    // Deterministic 403: no retry burst (that would be 3+ = 1 + retry×2) and
    // no refetch loop against the Worker. Up to 2 legitimate requests can
    // occur: FeatureGate renders children ungated while the session loads,
    // then remounts them gated once the tier resolves — the fresh mount
    // refetches the errored query once.
    expect(counters['gex-detail.json']).toBeLessThanOrEqual(2);
  });
});

test.describe('expired / no-subscription user', () => {
  test('dashboard portfolio tile shows the upgrade affordance (not "unavailable")', async ({ page }) => {
    await mockAuth(page, ME.none);
    await mockGated(page, { status: 403 }); // worker omits `need` for no_subscription
    await page.goto('/dashboard/');
    await expect(page.getByText(/is included with MapleGamma Basic/).first()).toBeVisible();
    const upgrade = page.getByRole('link', { name: 'Upgrade' }).first();
    await expect(upgrade).toHaveAttribute('href', '/account/');
    await expect(page.getByText("Portfolio data isn’t available right now.")).toHaveCount(0);
  });
});

test.describe('pro user', () => {
  test('sees the gamma wall with data and no gates anywhere', async ({ page }) => {
    await mockAuth(page, ME.pro);
    await mockGated(page, { grant: true });
    await page.goto('/options/');
    await expect(page.getByRole('img', { name: /Gamma profile for/ })).toBeVisible();
    await expect(page.getByText('Included with MapleGamma')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Upgrade to/ })).toHaveCount(0);
    // Flow table rendered real strike rows (not the gate, not skeletons).
    await expect(page.getByRole('cell', { name: /^\$\d+$/ }).first()).toBeVisible();
  });
});
