// Aufstieg feiern (docs/aufstieg.md, P16): Aufstieg zeigt die Feier, Weiter schließt sie,
// das Spiel läuft danach weiter, der Knopf bleibt auf jedem Gerät erreichbar.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

test('Aufstieg: Feier erscheint, Weiter schließt sie und das Spiel läuft weiter', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.aufstieg, null, { timeout: 15_000 });
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
    const st = g.sim.state;
    const ziel = g.sim.ctx.rules.stageGoals[st.stage];
    st.stageGuests = ziel.guests;
    st.ratings = st.ratings.map(() => 5);
    st.money = ziel.cost + 100;
    if (g.paused) g.setPaused(false);
    g.sim.advanceStage();
  });
  const feier = page.locator('#hm-feier');
  await expect(feier).toBeVisible();
  await expect(page.locator('.hm-feier-titel')).toHaveText('Dorfhafen am See');
  expect(await page.evaluate(() => window.hafenmeister.paused), 'Spiel pausiert während der Feier').toBe(true);
  const weiter = page.locator('.hm-feier-weiter');
  await expect(weiter).toBeInViewport();
  await press(weiter, testInfo);
  await expect(feier).toBeHidden();
  expect(await page.evaluate(() => window.hafenmeister.paused)).toBe(false);
  const chronik = await page.evaluate(() => window.hafenmeister.sim.state.modules.aufstieg.stufen);
  expect(chronik.map((s) => s.stufe)).toEqual([1]);
});

test('Aufstieg: neues Spiel ohne Neuladen schließt eine offene Feier', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.aufstieg, null, { timeout: 15_000 });
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.einstieg?.beenden?.();
    if (g.paused) g.setPaused(false);
    g.aufstieg.zeigeStufe(3);
  });
  await expect(page.locator('#hm-feier')).toBeVisible();
  await page.evaluate(() => window.hafenmeister.sim.newGame(7));
  await expect(page.locator('#hm-feier')).toBeHidden();
  expect(await page.evaluate(() => window.hafenmeister.paused), 'Spiel läuft nach dem Schließen weiter').toBe(false);
  expect(await page.evaluate(() => window.hafenmeister.aufstieg.offen)).toBe(false);
});
