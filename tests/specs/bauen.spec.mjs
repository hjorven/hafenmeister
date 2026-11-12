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
  await expect(page.locator('#card .bau-tab')).toHaveCount(4);

  await press(page.locator('#card .bau-tab', { hasText: 'Versorgung' }), testInfo);
  await press(page.locator('#card [data-bau="versorgung:wc"]'), testInfo);
  const ja = page.locator('#card .bau-ja');
  await expect(ja).toHaveText('Bauen für 80 €');
  // Die Vorschau allein kostet nichts
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(300);

  await press(ja, testInfo);
  await expect(page.locator('#card h2')).toContainText('ist gebaut');
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(220);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.facilities.wc)).toBe(1);
  expect(await steht(), 'Toilette steht nach dem Kauf nicht').toBe(true);

  await press(page.locator('#card .hud-btn', { hasText: 'Fertig' }), testInfo);
  await expect(page.locator('#card')).toBeHidden();
  await expect(page.locator('#bau-tipp')).toBeVisible();
  await expect(page.locator('#bau-tipp')).toContainText('Als Nächstes');
});
