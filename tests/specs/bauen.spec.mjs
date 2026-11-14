// Bauen mit Vorschau (docs/bauen.md): Baumodus öffnen, Vorschau, erst nach Bestätigen bezahlen,
// das Gebäude steht danach im Hafen, der Hinweis "Als Nächstes" erscheint.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

test('Bauen: Vorschau, Bestätigen, Gebäude steht', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.bauen, null, { timeout: 15_000 });
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
    g.sim.state.money = 300;
    g.emit('sim:change', {});
  });
  const steht = () => page.evaluate(() => !!window.hafenmeister.buildings?.items.find((i) => i.id === 'toilette')?.mesh.parent);
  expect(await steht(), 'Toilette steht schon vor dem Kauf').toBe(false);

  await press(page.locator('#btn-build'), testInfo);
  await expect(page.locator('#card.bau-karte')).toBeVisible();
  // Erstes Bauwerk (Roadmap J4): Das Toilettenhaeuschen ist geschenkt, die Vorschau steht gleich offen
  await expect(page.locator('#card .bau-geschenk')).toBeVisible();
  const ja = page.locator('#card .bau-ja');
  await expect(ja).toHaveText('Bauen für 80 €');
  await expect(ja).toHaveClass(/bau-leuchtet/);
  // Geschenk liegt in der Kasse, die Vorschau allein kostet nichts; es zaehlt nicht als Einnahme
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(380);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.stats.totalIncome)).toBe(0);
  // Zurueck zur Liste und ueber den Reiter wieder hin: dieselbe Vorschau, kein zweites Geschenk
  await press(page.locator('#card .hud-btn', { hasText: 'Zurück' }), testInfo);
  await expect(page.locator('#card .bau-tab')).toHaveCount(4);
  await press(page.locator('#card .bau-tab', { hasText: 'Versorgung' }), testInfo);
  await press(page.locator('#card [data-bau="versorgung:wc"]'), testInfo);
  await expect(ja).toHaveText('Bauen für 80 €');
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(380);

  await press(ja, testInfo);
  await expect(page.locator('#card h2')).toContainText('ist gebaut');
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(300);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.facilities.wc)).toBe(1);
  expect(await steht(), 'Toilette steht nach dem Kauf nicht').toBe(true);

  await press(page.locator('#card .hud-btn', { hasText: 'Fertig' }), testInfo);
  await expect(page.locator('#card')).toBeHidden();
  // Während des Einstiegs bleibt der Hinweis weg; der Einstieg startet nach newGame evtl. neu
  await page.evaluate(() => window.hafenmeister.einstieg?.beenden?.());
  await expect(page.locator('#bau-tipp')).toBeVisible();
  await expect(page.locator('#bau-tipp')).toContainText('Als Nächstes');

  // Wieder oeffnen: kein Geschenk mehr, die Liste kommt
  await press(page.locator('#btn-build'), testInfo);
  await expect(page.locator('#card .bau-tab')).toHaveCount(4);
  await expect(page.locator('#card .bau-geschenk')).toHaveCount(0);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(300);
});
