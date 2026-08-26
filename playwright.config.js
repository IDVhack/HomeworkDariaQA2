const { defineConfig, devices } = require('@playwright/test');

// SLOWMO=300 npx playwright test --headed --workers=1  — прогон вживую,
// тест за тестом, с видимым замедлением действий.
const slowMo = process.env.SLOWMO ? Number(process.env.SLOWMO) : 0;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:8934',
    trace: 'retain-on-failure',
    launchOptions: { slowMo },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/static-server.js',
    url: 'http://localhost:8934/index-local.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
