// Rauchtest der Spielschleife (Abnahme, docs/abnahme.md): Boot kommt an die Boje,
// wird ueber die Oberflaeche zugewiesen, abends wird kassiert und das Geld steigt.
// Die Zeit wird mit game.sim.fastForward vorgespult, alles andere laeuft ueber die Knoepfe.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

// Spielzeit vorspulen, bis die Bedingung im Spiel erfuellt ist (hoechstens ein paar Spieltage)
async function forwardUntil(page, condition, what) {
  const ok = await page.evaluate((cond) => {
    const sim = window.hafenmeister.sim;
    const check = new Function('sim', 'state', `return (${cond});`);
    for (let i = 0; i < 3000; i++) {
      if (check(sim, sim.state)) return true;
      sim.fastForward(1);
    }
    return check(sim, sim.state);
  }, condition);
  expect(ok, `Spielzeit vorgespult, aber nicht erreicht: ${what}`).toBe(true);
}

test('Boot kommt, wird zugewiesen, abends steigt das Geld', async ({ game }, testInfo) => {
  const { page } = game;
  // bridge.js richtet game.sim nach dem Laden der Bootsdaten ein, das kann kurz dauern
  const hasSim = await page.waitForFunction(() => !!window.hafenmeister.sim, null, { timeout: 15_000 })
    .then(() => true, () => false);
  expect(hasSim, 'game.sim fehlt: Spielregeln (web/js/bridge.js) nicht geladen').toBe(true);

  // Neues Spiel mit festem Seed, damit jeder Lauf gleich ist
  await page.evaluate(() => window.hafenmeister.sim.newGame(42));
  const startMoney = await page.evaluate(() => window.hafenmeister.sim.state.money);

  // 1. Ein Boot liegt an der Boje und erscheint in der Warteliste
  await forwardUntil(page, 'sim.waitingBoats().length > 0', 'ein Boot wartet an der Boje');
  const chip = page.locator('#queue .boat-chip').first();
  await expect(chip, 'wartendes Boot fehlt in der Warteliste unten').toBeVisible();
  const boatId = Number(await chip.getAttribute('data-boat'));

  // 2. Antippen oeffnet die Karte, "Automatisch einfahren" weist einen Platz zu
  await press(chip, testInfo);
  const card = page.locator('#card');
  await expect(card, 'Karte zum Boot geht nicht auf').toBeVisible();
  const auto = card.getByRole('button', { name: 'Automatisch einfahren' });
  await expect(auto).toBeEnabled();
  await press(auto, testInfo);
  await expect.poll(
    () => page.evaluate((id) => window.hafenmeister.sim.state.boats[id]?.status, boatId),
    { message: 'Boot liegt nach "Automatisch einfahren" nicht am Platz' },
  ).toBe('moored');

  // 3. Abends erscheint "Kassieren", Antippen bringt das Hafengeld
  await forwardUntil(page, "state.phase === 'evening' && sim.mooredBoats().some((b) => b.pendingFee > 0)",
    'Abend mit offenem Hafengeld');
  const collect = page.locator('#btn-collect');
  await expect(collect, 'Knopf "Kassieren" erscheint abends nicht').toBeVisible();
  const moneyText = await page.locator('#money').textContent();
  await press(collect, testInfo);

  await expect.poll(
    () => page.evaluate(() => window.hafenmeister.sim.state.money),
    { message: 'Geld steigt nach dem Kassieren nicht' },
  ).toBeGreaterThan(startMoney);
  await expect(page.locator('#money'), 'Geldanzeige oben aendert sich nicht').not.toHaveText(moneyText);
  await expect(collect).toBeHidden();
});
