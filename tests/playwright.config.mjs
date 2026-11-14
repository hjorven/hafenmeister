// Playwright-Einstellungen: dieselben Tests laufen in Handy-, Tablet- und PC-Groesse.
// Start (im Ordner tests/):  npx playwright test
import { defineConfig, devices } from '@playwright/test';

// Port des Testservers. tests/pruefen.sh waehlt jedes Mal einen freien Port (HM_TEST_PORT),
// damit nie ein alter, noch laufender Server einen veralteten Stand ausliefert.
const PORT = Number(process.env.HM_TEST_PORT || 4173);
const CI = !!process.env.CI;

// Software-WebGL (SwiftShader), damit Three.js auch ohne Grafikkarte rendert (CI, Container).
const launchOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};
// Optional: vorinstallierter Chromium, z. B. CHROMIUM_PATH=/opt/pw-browsers/chromium
if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;

// Software-WebGL rechnet jeden Bildpunkt auf der CPU: Tablet hochkant mit echter Dichte (2,25)
// schafft nur rund 3 Bilder pro Sekunde (330 ms je Bild), mit Dichte 1 rund 15 (60 ms). Alle Tests
// laufen daher mit Dichte 1 (Layout in CSS-Pixeln bleibt gleich). Nur die Bildschirmfotos nutzen
// die echte Dichte des Geraets (echteDichte, siehe start.spec.mjs), damit die Vorschau scharf ist.
const chromium = (device) => ({
  ...device, browserName: 'chromium', launchOptions,
  deviceScaleFactor: 1, echteDichte: device.deviceScaleFactor ?? 1,
});

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  // Das Spiel ist gewachsen: ein Test braucht allein schon 10 bis 25 s, unter Last doppelt so lange
  timeout: 90_000,
  // Unter Last (Software-WebGL, mehrere Browser parallel) kommen Klicks erst Sekunden spaeter im
  // Spiel an. 20 s lassen echten Fehlern trotzdem keinen Ausweg, sie werden nur langsamer rot.
  expect: { timeout: 20_000 },
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
    command: `bash ../tools/build-pages.sh && exec node server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/hafenmeister/`,
    // Nie einen schon laufenden Server benutzen: der koennte ein altes _site/ ausliefern
    // (z. B. nach einem abgebrochenen Lauf). Ist der Port belegt, bricht Playwright mit Meldung ab.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
