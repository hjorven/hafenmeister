// Große Ankünfte (P47, docs/grosse-ankuenfte.md): Ein Kreuzfahrtschiff läuft ein, tutet, die Meldung steht im
// Meldeplatz (nie über Zeit, Kassieren oder Bauen), die Kamera fährt kurz hin und wieder zurück. Jede
// Berührung beendet die Fahrt, die Kamera bleibt dann. Mit "Nur Horn" fährt sie nur auf Wunsch ("Ansehen").
import { test, expect, ohneEinstieg, kameraRuhig } from '../helpers.mjs';

// Je Test rund 45 s (Ankunft in Echtzeit): nur Handy und PC, wie kamera.spec.mjs
test.skip(({ projekt }) => projekt.startsWith('tablet'), 'Handy und PC reichen, CI-Zeit');

const ueberlappt = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function starte(page, wahl) {
  await page.addInitScript((w) => {
    try { localStorage.setItem('hafenmeister:einstellungen', JSON.stringify({ ankuenfte: w })); } catch {}
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
  }, wahl);
  await page.goto('./?stufe=6&services=alle&ankunft=kreuzfahrt');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.ankunft && !!window.hafenmeister.services?.besuche,
    null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.tagesziele?.waehle?.(0);
    window.__hoerner = [];
    g.on('horn', (d) => window.__hoerner.push(d));
    // Kurz vor das Einlaufen vorspulen (Ankunft ab Tagesanteil 0,03, Spielbereich ab rund 0,07)
    const L = g.sim.ctx?.rules?.dayLength ?? 270;
    const rest = 0.062 * L - (g.sim.state.clock ?? 0);
    if (rest > 0) g.sim.fastForward(rest);
  });
  await expect.poll(() => page.evaluate(() => window.hafenmeister.ankunft.aktuelle().length), { timeout: 20_000 }).toBeGreaterThan(0);
}

test('Kreuzfahrtschiff: Horn, Meldung, Kamerafahrt hin und zurück', async ({ game }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await starte(page, 'kamera');
  const vorher = await page.evaluate(() => { const c = window.hafenmeister.camera; return { x: c.target.x, z: c.target.z, w: c.viewWidth }; });
  // Horn beim Einlaufen, und gleich danach fährt die Kamera (die Meldung kann kurz hinter einer anderen warten)
  await expect.poll(() => page.evaluate(() => window.__hoerner.length), { timeout: 60_000 }).toBe(1);
  expect(await page.evaluate(() => window.__hoerner[0].groesse)).toBe('XXL');
  expect(await page.evaluate(() => window.hafenmeister.ankunft.letzterGrund)).toBe(null);
  expect(await page.evaluate(() => window.hafenmeister.ankunft.laeuft)).toBe(true);
  // Solange die Kamera fährt, steht die Meldung vorn, mit "Zurück"
  const meldung = page.locator('#hm-ankunft');
  await expect(meldung).toBeVisible();
  await expect(meldung).toContainText('Kreuzfahrtschiff läuft ein');
  await expect(meldung.locator('button')).toHaveText('Zurück');
  await expect.poll(() => page.evaluate(() => {
    const g = window.hafenmeister;
    const s = g.ankunft.aktuelle()[0]?.pos;
    const c = g.camera.target;
    return s ? Math.hypot(s.x - c.x, s.z - c.z) : 999;
  }), { timeout: 15_000 }).toBeLessThan(40);
  // ... und von selbst zurück an die alte Stelle
  await expect.poll(() => page.evaluate(() => window.hafenmeister.ankunft.laeuft), { timeout: 30_000 }).toBe(false);
  await kameraRuhig(page);
  const nachher = await page.evaluate(() => { const c = window.hafenmeister.camera; return { x: c.target.x, z: c.target.z, w: c.viewWidth }; });
  expect(Math.hypot(nachher.x - vorher.x, nachher.z - vorher.z)).toBeLessThan(3);
  expect(Math.abs(nachher.w - vorher.w) / vorher.w).toBeLessThan(0.03);
  // Kein zweites Horn für denselben Besuch
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__hoerner.length)).toBe(1);
});

test('Nur Horn: Kamera bleibt, "Ansehen" fährt hin, Berührung beendet die Fahrt', async ({ game, projekt }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await starte(page, 'horn');
  const meldung = page.locator('#hm-ankunft');
  await expect(meldung).toBeVisible({ timeout: 60_000 });
  // Anhalten: die Meldung bleibt dann stehen (ihre Zeit zählt nur, wenn das Spiel läuft)
  await page.evaluate(() => window.hafenmeister.setPaused(true));
  await expect(meldung).toBeVisible();
  expect(await page.evaluate(() => window.__hoerner.length)).toBe(1);
  expect(await page.evaluate(() => window.hafenmeister.ankunft.letzterGrund)).toBe('einstellung');
  expect(await page.evaluate(() => window.hafenmeister.ankunft.laeuft)).toBe(false);
  expect(await page.evaluate(() => window.hafenmeister.meldungen?.imPlatz?.(document.getElementById('hm-ankunft')) ?? true)).toBe(true);
  const kasten = await meldung.boundingBox();
  for (const sel of ['#btn-build', '#btn-pause', '#money', '#btn-menu', '#btn-collect']) {
    const k = await page.locator(sel).boundingBox().catch(() => null);
    if (k && kasten && k.width > 0) expect(ueberlappt(kasten, k), `Meldung über ${sel}`).toBe(false);
  }
  const ansehen = meldung.locator('.hm-primaer');
  await expect(ansehen).toHaveText('Ansehen');
  const start = await page.evaluate(() => { const c = window.hafenmeister.camera.target; return { x: c.x, z: c.z }; });
  await ansehen.click();
  await expect.poll(() => page.evaluate(() => window.hafenmeister.ankunft.laeuft)).toBe(true);
  // Erst ankommen lassen (das Spiel steht, das Schiff auch); auf langsamen Rechnern dauert der Anflug länger
  const abstandZumSchiff = () => page.evaluate(() => {
    const g = window.hafenmeister;
    const s = g.ankunft.aktuelle()[0]?.pos;
    const c = g.camera.target;
    return s ? Math.hypot(s.x - c.x, s.z - c.z) : 999;
  });
  await expect.poll(abstandZumSchiff, { timeout: 20_000 }).toBeLessThan(40);
  // Spieler fasst die Karte an: Fahrt aus, die Kamera bleibt, wo sie ist, und fährt nicht zurück
  const mitte = { x: (page.viewportSize().width / 2) | 0, y: (page.viewportSize().height * 0.35) | 0 };
  if (projekt.startsWith('handy') || projekt.startsWith('tablet')) await page.touchscreen.tap(mitte.x, mitte.y);
  else await page.mouse.wheel(0, -40);
  await expect.poll(() => page.evaluate(() => window.hafenmeister.ankunft.laeuft)).toBe(false);
  await kameraRuhig(page);
  const ort = () => page.evaluate(() => { const c = window.hafenmeister.camera.target; return { x: c.x, z: c.z }; });
  const a = await ort();
  await page.waitForTimeout(2500);
  const b = await ort();
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(2);
  expect(Math.hypot(b.x - start.x, b.z - start.z)).toBeGreaterThan(100);
});
