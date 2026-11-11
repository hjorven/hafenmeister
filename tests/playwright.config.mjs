// Playwright-Einstellungen: dieselben Tests laufen in Handy-, Tablet- und PC-Groesse.
// Start (im Ordner tests/):  npx playwright test
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const CI = !!process.env.CI;

// Software-WebGL (SwiftShader), damit Three.js auch ohne Grafikkarte rendert (CI, Container).
const launchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};
// Optional: vorinstallierter Chromium, z. B. CHROMIUM_PATH=/opt/pw-browsers/chromium
if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;

const chromium = (device) => ({ ...device, browserName: 'chromium', launchOptions });

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['github'], ['list'], ['html', { outputFolder: 'bericht', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'bericht', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}/hafenmeister/`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'handy', use: chromium(devices['Pixel 7']) },
    { name: 'handy-quer', use: chromium(devices['Pixel 7 landscape']) },
    { name: 'tablet', use: chromium(devices['Galaxy Tab S4']) },
    { name: 'tablet-quer', use: chromium(devices['Galaxy Tab S4 landscape']) },
    { name: 'pc', use: chromium({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }) },
  ],
  webServer: {
    command: `bash ../tools/build-pages.sh && node server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/hafenmeister/`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
