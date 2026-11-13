// Wettereffekte (docs/ereignisse.md, Abschnitt Leistung): Regen, Schnee und Nebel liegen in der
// 3D-Szene, nicht auf einer zweiten Leinwand. Jedes Wetter zeigt sich, nichts ist antippbar,
// und bei schönem Wetter wird gar nichts zusätzlich gezeichnet.
import { test, expect } from '../helpers.mjs';

const WETTER = {
  sturm: { wind: 1, fog: 0.2, rain: 1, snow: 0, sun: 0, event: 'sturm' },
  nebel: { wind: 0.1, fog: 1, rain: 0, snow: 0, sun: 0.2, event: 'nebel' },
  winter: { wind: 0.3, fog: 0.2, rain: 0, snow: 1, sun: 0.3 },
  sommertag: { wind: 0.2, fog: 0, rain: 0, snow: 0, sun: 1, event: 'sommertag' },
};

test('Wetter: Effekte in der Szene, keine zweite Leinwand', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.wetterEffekte, null, { timeout: 15_000 });
  expect(await page.locator('#weather-fx').count(), 'alte 2D-Wetterebene ist noch da').toBe(0);

  for (const [name, wx] of Object.entries(WETTER)) {
    const stand = await page.evaluate((wx) => {
      const g = window.hafenmeister;
      g.emit('weather', wx);
      g.wetterEffekte.sofort();
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(g.wetterEffekte.stand))));
    }, wx);
    expect(stand.sichtbar, `${name}: Effekt sichtbar`).toBe(name !== 'sommertag');
  }

  // Der Schleier ist nie antippbar: Mitte des Bildes trifft weiter das, was darunter liegt
  const getroffen = await page.evaluate(() => {
    const g = window.hafenmeister;
    g.emit('weather', { wind: 1, fog: 1, rain: 1, snow: 0, sun: 0 });
    g.wetterEffekte.sofort();
    const r = g.canvas.getBoundingClientRect();
    const hit = g.pick(r.left + r.width / 2, r.top + r.height / 2);
    return hit?.object?.name ?? null;
  });
  expect(getroffen).not.toBe('wetter-effekte');
});
