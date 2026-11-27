// Hafen verschönern (P60, docs/verschoenern.md): Reiter Deko im Baumenü passt aufs Gerät, Vorschau zeigt
// Geisterbild, erst Bestätigen kauft, Stücke stehen an Land, Bewertung steigt, Rückgängig nimmt alles zurück,
// Anstrich mit Farbwahl färbt die Hafenhäuser und übersteht Neuladen.
import { test, expect, isTouchProject } from '../helpers.mjs';
import { ECONOMY } from '../../web/js/data/economy.js';

const V = ECONOMY.verschoenern;

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

test('Deko: Bänke mit Vorschau kaufen, Rückgängig, Anstrich mit Farbe', async ({ game }, testInfo) => {
  test.setTimeout(150_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.bauen && !!window.hafenmeister.verschoenern?.plaetze, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
    sim.applyTestStage(g.sim.state, g.sim.ctx, 2);
    g.sim.state.testmodus = false;   // echter Spielstand, damit Speichern und Neuladen gehen
    g.emit('stufe', 2);
    g.sim.state.money = 5000;
    g.emit('sim:change', {});
  });
  await page.waitForTimeout(800);

  await press(page.locator('#btn-build'), testInfo);
  await expect(page.locator('#card.bau-karte')).toBeVisible();
  const deko = page.locator('#card .bau-tab', { hasText: 'Deko' });
  await expect(deko).toBeVisible();
  // Alle fünf Reiter liegen ganz auf dem Bildschirm, keiner wird abgeschnitten
  const tabs = await page.$$eval('#card .bau-tab', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, voll: e.scrollWidth <= e.clientWidth + 1 }; }));
  const vw = page.viewportSize().width;
  for (const t of tabs) { expect(t.l).toBeGreaterThanOrEqual(0); expect(t.r).toBeLessThanOrEqual(vw + 1); expect(t.voll).toBe(true); }
  await press(deko, testInfo);
  const zeile = page.locator('#card .bau-zeile[data-bau="deko:baenke"]');
  await expect(zeile).toBeVisible();
  await expect(page.locator('#card .bau-zeile[data-bau="deko:anstrich"]')).toBeVisible();

  // Vorschau: Geisterbild, noch nichts bezahlt
  const geld0 = await page.evaluate(() => window.hafenmeister.sim.state.money);
  await press(zeile, testInfo);
  const ja = page.locator('#card .bau-ja');
  await expect(ja).toHaveText(`Bauen für ${V.arten.baenke.abschnitte[0].kosten} €`);
  expect(await page.evaluate(() => !!window.hafenmeister.scene.getObjectByName('bauen-geist'))).toBe(true);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(geld0);
  expect(await page.evaluate(() => window.hafenmeister.verschoenern.stuecke().length)).toBe(0);

  // Bestätigen: Bänke stehen auf Land, die Bewertung steigt
  await ja.scrollIntoViewIfNeeded();
  await press(ja, testInfo);
  await expect(page.locator('#card .bau-rueck')).toBeVisible();
  await page.waitForFunction(() => window.hafenmeister.verschoenern.stuecke().length > 0, null, { timeout: 5000 });
  const nach = await page.evaluate(() => {
    const g = window.hafenmeister;
    const s = g.verschoenern.stuecke();
    return { s, land: s.map((o) => g.landschaft.hoeheBei(o.x, o.z) > g.landschaft.pegel), geld: g.sim.state.money, bonus: g.verschoenern.bonus() };
  });
  expect(nach.s.length).toBe(V.arten.baenke.abschnitte[0].stueck);
  expect(nach.land.every(Boolean)).toBe(true);
  expect(nach.geld).toBe(geld0 - V.arten.baenke.abschnitte[0].kosten);
  expect(nach.bonus).toBeCloseTo(V.anker, 5);

  // Rückgängig: Geld und Bänke zurück
  await press(page.locator('#card .bau-rueck'), testInfo);
  await page.waitForFunction(() => window.hafenmeister.verschoenern.stuecke().length === 0, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(geld0);
  expect(await page.evaluate(() => window.hafenmeister.verschoenern.bonus())).toBe(0);

  // Anstrich: Farbe wählen färbt in der Vorschau, Zurück stellt zurück, Bauen behält sie
  await page.evaluate(() => window.hafenmeister.bauen.vorschau('deko:anstrich'));
  const blau = page.locator('#card .bau-farbe[data-farbe="friesenblau"]');
  await expect(blau).toBeVisible();
  await press(blau, testInfo);
  await expect(blau).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.hafenmeister.buildings.anstrichFarbe)).toBe('#3f6f98');
  await press(page.locator('#card .hud-btn', { hasText: 'Zurück' }), testInfo);
  expect(await page.evaluate(() => window.hafenmeister.buildings.anstrichFarbe)).toBe(null);
  await page.evaluate(() => window.hafenmeister.bauen.vorschau('deko:anstrich'));
  await press(page.locator('#card .bau-farbe[data-farbe="ockergelb"]'), testInfo);
  const ja2 = page.locator('#card .bau-ja');
  await ja2.scrollIntoViewIfNeeded();
  await press(ja2, testInfo);
  await page.waitForFunction(() => window.hafenmeister.sim.state.modules?.verschoenern?.anstrich === 'ockergelb', null, { timeout: 5000 });
  expect(await page.evaluate(() => window.hafenmeister.buildings.anstrichFarbe)).toBe('#dfae4c');
  await press(page.locator('#card .hud-btn', { hasText: 'Fertig' }), testInfo);

  // Neu laden: Farbe bleibt
  expect(await page.evaluate(() => window.hafenmeister.spielstand.speichern()), 'Spielstand gespeichert').toBeTruthy();
  await page.reload();
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.verschoenern?.plaetze, null, { timeout: 45_000 });
  await page.waitForFunction(() => window.hafenmeister.buildings?.anstrichFarbe === '#dfae4c', null, { timeout: 10_000 });
});
