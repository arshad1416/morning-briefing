// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://briefing.arshadkazi.ca',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14 Pro Max'],          // 430 x 932
        defaultBrowserType: 'webkit',
      },
    },
    {
      name: 'mobile-safari-se',   // iPhone SE (narrower)
      use: {
        ...devices['iPhone SE'],                  // 375 x 667
        defaultBrowserType: 'webkit',
      },
    },
    {
      name: 'mobile-safari-small',  // 400px breakpoint boundary
      use: {
        ...devices['iPhone 14 Pro Max'],
        defaultBrowserType: 'webkit',
        viewport: { width: 400, height: 844 },
      },
    },
    {
      name: 'mobile-safari-tight',  // below 400px breakpoint
      use: {
        viewport: { width: 380, height: 667 },
        defaultBrowserType: 'webkit',
        isMobile: true,
      },
    },
  ],
});
