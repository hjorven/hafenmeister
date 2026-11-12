// Startet das Spiel ohne Fehler? Wird etwas gezeichnet? Bildschirmfotos pro Geraet.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, optionalModules, imageStats } from '../helpers.mjs';

test('Spiel startet ohne Fehler', async ({ game }) => {
  const { page } = game;
  await expect(page).toHaveTitle(/Hafenmeister/);
  await expect(page.locator('#stage')).toBeVisible();
  const info = await page.evaluate(() => ({
    hasGame: typeof window.hafenmeister === 'object',
    webgl: !!window.hafenmeister?.renderer?.getContext(),
    sceneChildren: window.hafenmeister?.scene?.children.length ?? 0,
  }));
  expect(info.hasGame, 'window.hafenmeister fehlt').toBe(true);
  expect(info.webgl, 'kein WebGL-Kontext').toBe(true);
  expect(info.sceneChildren, 'Szene ist leer').toBeGreaterThan(0);
});

test('Vorhandene Module aus main.js laden fehlerfrei', async ({ game }) => {
  const { page } = game;
  const present = optionalModules().filter((m) => m.exists);
  for (const m of present) {
    const err = await page.evaluate(async (rel) => {
      try { await import(new URL(rel, document.baseURI).href); return null; }
      catch (e) { return String(e?.message ?? e); }
    }, m.rel);
    expect(err, `web/${m.rel} laedt nicht`).toBeNull();
  }
});

test('Spielflaeche zeigt ein Bild (nicht leer, nicht schwarz)', async ({ game }) => {
  const { page } = game;
  const shot = await page.locator('#stage').screenshot();
  const stats = imageStats(shot);
  expect(stats.darkShare, 'Bild ist fast ganz schwarz').toBeLessThan(0.9);
  expect(stats.colors, 'Bild hat kaum Farben, vermutlich wird nichts gezeichnet').toBeGreaterThanOrEqual(3);
});

test('Bildschirmfotos', async ({ game }, testInfo) => {
  // Zwei Vollbilder vom ganzen Hafen: auf Tablets mit Software-Grafik (CI) laeuft das
  // inzwischen mit rund 3 Bildern pro Sekunde, daher die dreifache Zeit
  test.slow();
  const { page } = game;
  const dir = path.join(testInfo.config.rootDir, '..', 'bildschirmfotos');
  fs.mkdirSync(dir, { recursive: true });
  const name = testInfo.project.name;

  // Startansicht
  await page.waitForTimeout(300);
  const start = await page.screenshot();
  fs.writeFileSync(path.join(dir, `${name}-start.png`), start);
  await testInfo.attach(`${name}-start`, { body: start, contentType: 'image/png' });

  // Ganz herausgezoomt
  await page.evaluate(() => window.hafenmeister.camera.zoomAt(0.01));
  await page.waitForTimeout(300);
  const weit = await page.screenshot();
  fs.writeFileSync(path.join(dir, `${name}-weit.png`), weit);
  await testInfo.attach(`${name}-weit`, { body: weit, contentType: 'image/png' });
});
