const { chromium, devices } = require(require('path').join(__dirname, '../../tests/node_modules/playwright'));
const path = require('path');
const GERAETE = {
  handy: devices['iPhone 13'],
  'handy-quer': devices['iPhone 13 landscape'],
  tablet: devices['Galaxy Tab S4'],
  'tablet-quer': devices['Galaxy Tab S4 landscape'],
  pc: { viewport: { width: 1440, height: 900 } },
};
async function browser() { return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); }
async function open(b, geraet, query = '', dsf = 1) {
  const ctx = await b.newContext({ ...GERAETE[geraet], deviceScaleFactor: dsf, serviceWorkers: 'block', locale: 'de-DE' });
  const page = await ctx.newPage();
  const log = [];
  page.on('pageerror', (e) => log.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log.push('[err] ' + m.text()); });
  await page.goto(`http://localhost:${process.env.HM_PORT || 4180}/hafenmeister/` + query);
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('done') || document.getElementById('boot')?.classList.contains('error'), null, { timeout: 45000 });
  await page.waitForFunction(() => window.hafenmeister && window.hafenmeister.time > 0.1, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  return { ctx, page, log };
}
// Anteil der Bildfläche, an dem nicht die Spielfläche liegt (Raster 6 px)
async function verdeckt(page) {
  return page.evaluate(() => {
    const stage = document.getElementById('stage');
    const canvas = stage.querySelector('canvas');
    const S = 6; let n = 0, z = 0; const wer = {};
    for (let y = S / 2; y < innerHeight; y += S) for (let x = S / 2; x < innerWidth; x += S) {
      n++;
      const e = document.elementFromPoint(x, y);
      if (!e || e === stage || e === canvas || e === document.body || e === document.documentElement) continue;
      z++;
      let t = e; while (t.parentElement && t.parentElement !== document.body && !t.id) t = t.parentElement;
      const k = t.id ? '#' + t.id : t.className?.toString().split(' ')[0] || t.tagName;
      wer[k] = (wer[k] || 0) + 1;
    }
    const anteile = Object.fromEntries(Object.entries(wer).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(1000 * v / n) / 10]));
    return { prozent: Math.round(1000 * z / n) / 10, anteile };
  });
}
module.exports = { browser, open, verdeckt, GERAETE };
