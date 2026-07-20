// @ts-check
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const archiveIndex = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../public/data/archive-index.json'), 'utf8'),
);
const GENERATED_ARCHIVE_DATE = archiveIndex.dates[0];

const CONCRETE_ROUTES = [
  '/',
  '/account/',
  '/archive/',
  '/charts/',
  '/dashboard/',
  '/login/',
  '/models/',
  '/options/',
  '/positions/',
  '/predictions/',
  '/research/',
  '/screener/',
  '/signup/',
  '/ticker/?symbol=SPY',
];

const PRIORITY_ROUTES = ['/dashboard/', '/options/', '/models/'];
const AUTH_ROUTES = new Set(['/login/', '/signup/']);

function buildChartData() {
  const bars = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, index + 1));
    const baseline = 150 + Math.sin(index / 6) * 8;
    return {
      time: date.toISOString().slice(0, 10),
      open: baseline,
      high: baseline + 4,
      low: baseline - 4,
      close: baseline + Math.sin(index / 3),
      volume: 1_000_000 + index * 1_000,
    };
  });

  return {
    ticker: 'SPY',
    generated_at: '2025-03-31T12:00:00Z',
    timeframes: { '1D': bars, '1W': bars, '1M': bars, '1Y': bars },
  };
}

async function installMocks(page, { loggedIn }) {
  await page.route('**/api/auth/me*', async (route) => {
    if (!loggedIn) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'responsive-test-user',
        email: 'responsive@example.com',
        briefingOptIn: true,
        entitlement: { entitled: true, tier: 'pro', status: 'active' },
      }),
    });
  });

  await page.route('**/api/data/**', async (route) => {
    if (!loggedIn) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      });
      return;
    }

    const pathname = new URL(route.request().url()).pathname;
    const payload = pathname.includes('/api/data/charts') ? buildChartData() : {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });

  await page.route('**/*cloudflareinsights.com/**', (route) => route.abort());
  await page.route('**/*google-analytics.com/**', (route) => route.abort());
}

async function settleLayout(page) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function measureOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const scrollWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
    const offenders = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      })
      .filter(({ rect }) => rect.width > 0 && (rect.left < -0.5 || rect.right > clientWidth + 0.5))
      .slice(0, 5)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
      }));

    return { clientWidth, scrollWidth, offenders };
  });
}

function boxesIntersect(first, second) {
  return Boolean(
    first &&
      second &&
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y,
  );
}

function isMobileProject(testInfo) {
  return testInfo.project.name.endsWith('mobile-320');
}

test.describe('responsive route matrix', () => {
  test('all concrete routes stay within the document viewport', async ({ context }) => {
    for (const routePath of CONCRETE_ROUTES) {
      await test.step(routePath, async () => {
        const page = await context.newPage();
        await installMocks(page, { loggedIn: !AUTH_ROUTES.has(routePath) });

        const response = await page.goto(routePath, { waitUntil: 'domcontentloaded' });
        expect.soft(response?.status(), `${routePath} must return a document`).toBeLessThan(400);
        await settleLayout(page);

        const measurement = await measureOverflow(page);
        expect.soft(
          measurement.scrollWidth,
          `${routePath} overflowed ${measurement.clientWidth}px viewport; offenders=${JSON.stringify(measurement.offenders)}`,
        ).toBeLessThanOrEqual(measurement.clientWidth);
        await page.close();
      });
    }
  });

  test('a generated archive-detail route stays within the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'One engine is sufficient for dynamic-route discovery.');
    await installMocks(page, { loggedIn: true });
    expect(GENERATED_ARCHIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const response = await page.goto(`/archive/${GENERATED_ARCHIVE_DATE}/`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    await settleLayout(page);
    const measurement = await measureOverflow(page);
    expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth);
  });
});

test.describe('320px regression contracts', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!isMobileProject(testInfo), 'The contract targets the 320px projects.');
  });

  for (const loggedIn of [false, true]) {
    test(`priority app routes do not overflow when ${loggedIn ? 'signed in' : 'signed out'}`, async ({ page }) => {
      for (const routePath of PRIORITY_ROUTES) {
        await test.step(routePath, async () => {
          const routePage = await page.context().newPage();
          try {
            await installMocks(routePage, { loggedIn });
            await routePage.goto(routePath, { waitUntil: 'domcontentloaded' });
            await settleLayout(routePage);
            const measurement = await measureOverflow(routePage);
            expect.soft(
              measurement.scrollWidth,
              `${routePath} (${loggedIn ? 'signed in' : 'signed out'}) overflowed; offenders=${JSON.stringify(measurement.offenders)}`,
            ).toBeLessThanOrEqual(measurement.clientWidth);
          } finally {
            await routePage.close();
          }
        });
      }
    });
  }

  test('edit-layout mode keeps the header and controls within 320px', async ({ page }) => {
    await installMocks(page, { loggedIn: true });
    await page.goto('/dashboard/', { waitUntil: 'domcontentloaded' });
    await settleLayout(page);

    const edit = page.getByRole('button', { name: 'Edit layout' });
    const reset = page.getByRole('button', { name: 'Reset layout' });
    await expect(async () => {
      if (!(await reset.isVisible())) await edit.click();
      await expect(reset).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 5_000 });

    const measurement = await measureOverflow(page);
    expect(
      measurement.scrollWidth,
      `edit-layout header overflowed; offenders=${JSON.stringify(measurement.offenders)}`,
    ).toBeLessThanOrEqual(measurement.clientWidth);

    for (const control of [reset, page.getByRole('button', { name: 'Done editing layout' })]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('header stays contained across narrow breakpoint widths', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile-320', 'One engine is sufficient for breakpoint transitions.');

    for (const width of [360, 400, 414, 480]) {
      await test.step(`${width}px edit mode`, async () => {
        const routePage = await page.context().newPage();
        try {
          await routePage.setViewportSize({ width, height: 700 });
          await installMocks(routePage, { loggedIn: false });
          await routePage.goto('/dashboard/', { waitUntil: 'domcontentloaded' });
          await settleLayout(routePage);

          const edit = routePage.getByRole('button', { name: 'Edit layout' });
          const reset = routePage.getByRole('button', { name: 'Reset layout' });
          await expect(async () => {
            if (!(await reset.isVisible())) await edit.click();
            await expect(reset).toBeVisible({ timeout: 1_000 });
          }).toPass({ timeout: 5_000 });

          const measurement = await measureOverflow(routePage);
          expect(
            measurement.scrollWidth,
            `${width}px edit-layout header overflowed; offenders=${JSON.stringify(measurement.offenders)}`,
          ).toBeLessThanOrEqual(measurement.clientWidth);
        } finally {
          await routePage.close();
        }
      });
    }
  });

  test('feedback is absent from login and signup', async ({ page }) => {
    for (const routePath of ['/login/', '/signup/']) {
      await test.step(routePath, async () => {
        const routePage = await page.context().newPage();
        try {
          await installMocks(routePage, { loggedIn: false });
          await routePage.goto(routePath, { waitUntil: 'domcontentloaded' });
          await settleLayout(routePage);
          await expect(routePage.getByRole('button', { name: 'Send feedback' })).toHaveCount(0);
        } finally {
          await routePage.close();
        }
      });
    }
  });

  test('feedback does not collide with mobile application navigation', async ({ page }) => {
    await installMocks(page, { loggedIn: true });
    await page.goto('/dashboard/', { waitUntil: 'domcontentloaded' });
    await settleLayout(page);

    const feedback = page.getByRole('button', { name: 'Send feedback' });
    const mobileNav = page.locator('nav.fixed').last();
    await expect(feedback).toBeVisible();
    await expect(mobileNav).toBeVisible();
    expect(boxesIntersect(await feedback.boundingBox(), await mobileNav.boundingBox())).toBe(false);

    const dialog = page.getByRole('dialog', { name: 'Feedback form' });
    await expect(async () => {
      if (!(await dialog.isVisible())) await feedback.click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: 'Close feedback form' })).toBeFocused();
    expect(boxesIntersect(await dialog.boundingBox(), await mobileNav.boundingBox())).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(feedback).toBeFocused();
  });

  test('mobile More sheet is accessible and keeps every target at least 44px', async ({ page }) => {
    await installMocks(page, { loggedIn: true });
    await page.goto('/research/', { waitUntil: 'domcontentloaded' });
    await settleLayout(page);

    const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
    const more = mobileNav.locator('button').filter({ hasText: /^More$/ });
    await expect(mobileNav).toBeVisible();
    await expect(more).toHaveAttribute('aria-current', 'page');
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    const primaryLabels = await mobileNav.locator('a').allTextContents();
    expect(primaryLabels.map((label) => label.trim())).toEqual(['Dashboard', 'Positions', 'Options', 'Screener']);

    for (const target of await mobileNav.locator('a, button').all()) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const sheet = page.getByRole('dialog', { name: 'More destinations' });
    const close = sheet.getByRole('button', { name: 'Close More menu' });
    await expect(async () => {
      if (!(await sheet.isVisible())) await more.click();
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 5_000 });
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(mobileNav).toHaveAttribute('inert', '');
    await expect(mobileNav).toHaveAttribute('aria-hidden', 'true');
    await expect(close).toBeFocused();

    for (const label of ['Research', 'Charts', 'Models', 'Engine Tuning', 'Archive']) {
      await expect(sheet.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    await page.keyboard.press('Shift+Tab');
    await expect(sheet.getByRole('link', { name: 'Archive', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(mobileNav).not.toHaveAttribute('inert', '');
    await expect(more).toBeFocused();

    await more.click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('link', { name: 'Charts', exact: true }).click();
    await expect(page).toHaveURL(/\/charts\/$/);
    await expect(more).not.toBeFocused();
  });
});

test.describe('landing motion contracts', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile-320', 'One mobile engine is sufficient for motion behavior.');
  });

  test('incremental scrolling reveals off-screen content', async ({ page }) => {
    await installMocks(page, { loggedIn: false });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settleLayout(page);

    const reveal = page.locator('#features > div').first();
    await expect(reveal).toHaveCount(1);
    await expect.poll(
      () => reveal.evaluate((element) => Number(getComputedStyle(element).opacity)),
      { timeout: 10_000 },
    ).toBeLessThan(0.1);
    await expect.poll(
      () => reveal.evaluate((element) => element.getBoundingClientRect().top >= window.innerHeight),
    ).toBe(true);

    for (let step = 0; step < 12; step += 1) {
      const inViewport = await reveal.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top < window.innerHeight && bounds.bottom > 0;
      });
      if (inViewport) break;
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.7));
      await settleLayout(page);
    }

    await expect.poll(() => reveal.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.top < window.innerHeight && bounds.bottom > 0;
    })).toBe(true);
    await expect(reveal).toHaveCSS('opacity', '1');
  });

  test('reveal content is immediately visible with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installMocks(page, { loggedIn: false });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settleLayout(page);

    const reveal = page.locator('#features > div').first();
    const state = await reveal.evaluate((element) => ({
      opacity: Number(getComputedStyle(element).opacity),
      belowViewport: element.getBoundingClientRect().top >= window.innerHeight,
    }));
    expect(state.belowViewport).toBe(true);
    expect(state.opacity).toBe(1);
  });
});

test.describe('current charts implementation', () => {
  test('renders aligned, contained lightweight chart surfaces', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'Canvas wiring needs one deterministic engine.');
    await installMocks(page, { loggedIn: true });
    await page.goto('/charts/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Interactive Charts/i })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Price · EMA 20/i })).toBeVisible();

    const paneHeadings = [
      page.getByRole('heading', { name: /Price · EMA 20/i }),
      page.getByRole('heading', { name: 'RSI (14)' }),
      page.getByRole('heading', { name: 'ATR (14)' }),
    ];
    const paneBoxes = [];
    for (const heading of paneHeadings) {
      const pane = heading.locator('../..');
      const paneBox = await pane.boundingBox();
      expect(paneBox?.width).toBeGreaterThan(0);
      paneBoxes.push(paneBox);

      const canvases = pane.locator('canvas');
      expect(await canvases.count()).toBeGreaterThan(0);
      for (const canvas of await canvases.all()) {
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox?.width).toBeGreaterThan(0);
        expect(canvasBox?.height).toBeGreaterThan(0);
        expect(canvasBox.x).toBeGreaterThanOrEqual(paneBox.x - 1);
        expect(canvasBox.x + canvasBox.width).toBeLessThanOrEqual(paneBox.x + paneBox.width + 1);
      }
    }

    expect(Math.max(...paneBoxes.map((box) => box.width)) - Math.min(...paneBoxes.map((box) => box.width))).toBeLessThanOrEqual(1);
  });
});
