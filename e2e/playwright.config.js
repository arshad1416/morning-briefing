// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

const PORT = process.env.PORT || '3000';
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const repoRoot = path.resolve(__dirname, '..');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['json', { outputFile: 'results.json' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'webkit-tablet',
      use: {
        browserName: 'webkit',
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-mobile-320',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'webkit-mobile-320',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 320, height: 568 },
      },
    },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: `npm run build && python3 -m http.server ${PORT} --bind 127.0.0.1 --directory out 2>/dev/null`,
    url: baseURL,
    cwd: repoRoot,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
