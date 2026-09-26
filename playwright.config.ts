import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 60000,
  expect: { timeout: 8000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5187',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: 'node scripts/dev.mjs',
    env: { WAYPOINT_E2E: '1', PORT: '3017', VITE_PORT: '5187', APP_ORIGIN: 'http://127.0.0.1:5187', DATABASE_PATH: `./data/e2e-${Date.now()}.sqlite` },
    url: 'http://127.0.0.1:5187', reuseExistingServer: false, timeout: 30000,
  },
})
