// Rauchtest der Spielschleife (Abnahme, docs/abnahme.md): Boot kommt an die Boje,
// wird ueber die Oberflaeche zugewiesen, abends wird kassiert und das Geld steigt.
// Die Zeit wird mit game.sim.fastForward vorgespult, alles andere laeuft ueber die Knoepfe.
import { test, expect, isTouchProject, stageCenter } from '../helpers.mjs';

async function press(locator, testInfo, options = {}) {
  if (isTouchProject(testInfo)) await locator.tap(options);
  else await locator.click(options);
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

// Bildschirmpunkt des 3D-Boots (userData.pick = { type: 'boat', id }). Die Kamera wird auf das Boot
// gesetzt, damit es sicher im Bild und nicht unter einer Leiste liegt.
async function boatOnScreen(page, boatId) {
  // boat-view.js meldet 'boot:an-boje', sobald das Boot sichtbar an der Boje fest ist.
  // Bis dahin schneller laufen lassen, damit das Einlaufen nicht eine halbe Minute dauert.
  await page.evaluate(() => { window.hafenmeister.speed = 6; });
  await expect.poll(
    () => page.evaluate((id) => window.__anBoje.has(String(id).replace(/^b/, '')), boatId),
    { message: '3D-Boot kommt nicht an der Boje an (Ereignis boot:an-boje fehlt)', timeout: 40_000 },
  ).toBe(true);
  // Anhalten, damit das Boot nicht mehr schaukelt: Antippen und der Knopf am Boot liegen dann still
  await page.evaluate(() => { window.hafenmeister.speed = 1; window.hafenmeister.setPaused(true); });

  const free = await stageCenter(page);
  return page.evaluate(({ id, free }) => {
    const g = window.hafenmeister;
    const cam = g.camera;
    let obj = null;
    g.scene.traverse((o) => {
      const pk = o.userData?.pick;
      if (!obj && pk?.type === 'boat' && String(pk.id).replace(/^b/, '') === String(id)) obj = o;
    });
    // Boot auf den freien Punkt der Spielflaeche schieben
    const v = obj.getWorldPosition(new g.THREE.Vector3()).project(cam.camera);
    const sx = (v.x + 1) / 2 * cam.screenW, sy = (1 - v.y) / 2 * cam.screenH;
    cam.panBy(free.x - sx, free.y - sy);
    const v2 = obj.getWorldPosition(new g.THREE.Vector3()).project(cam.camera);
    return { x: (v2.x + 1) / 2 * cam.screenW, y: (1 - v2.y) / 2 * cam.screenH };
  }, { id: boatId, free });
}

test('Boot kommt, wird zugewiesen, abends steigt das Geld', async ({ game }, testInfo) => {
  test.setTimeout(120_000);
  const { page } = game;
  // bridge.js richtet game.sim nach dem Laden der Bootsdaten ein, das kann kurz dauern
  const hasSim = await page.waitForFunction(() => !!window.hafenmeister.sim, null, { timeout: 15_000 })
    .then(() => true, () => false);
  expect(hasSim, 'game.sim fehlt: Spielregeln (web/js/bridge.js) nicht geladen').toBe(true);

  // Neues Spiel mit festem Seed, damit jeder Lauf gleich ist
  await page.evaluate(() => {
    window.__anBoje = new Set();
    window.hafenmeister.on('boot:an-boje', (d) => window.__anBoje.add(String(d?.id).replace(/^b/, '')));
    window.hafenmeister.sim.newGame(42);
  });
  const startMoney = await page.evaluate(() => window.hafenmeister.sim.state.money);

  // 1. Ein Boot liegt an der Boje und erscheint in der Warteliste
  await forwardUntil(page, 'sim.waitingBoats().length > 0', 'ein Boot wartet an der Boje');
  const boatId = await page.evaluate(() => window.hafenmeister.sim.waitingBoats()[0].id);
  // Festhalten wie ein ausgewähltes Boot: sonst fährt es bei Andrang (Zeit zählt ab Ankunft im Revier)
  // von selbst in eine Box, bevor es die Boje erreicht. Die Anfahrt vom Kartenrand ist lang (Fahrwasser).
  await page.evaluate((id) => window.hafenmeister.sim.holdBoat?.(id, true), boatId);

  // 2. Boot antippen: in 3D an der Boje (game.boatsVisible) oder in der Warteliste unten
  const in3d = await page.evaluate(() => !!window.hafenmeister.boatsVisible);
  if (in3d) {
    // Warten, bis das 3D-Boot existiert und an der Boje stillliegt, dann die Kamera daraufsetzen
    const pos = await boatOnScreen(page, boatId);
    if (isTouchProject(testInfo)) await page.touchscreen.tap(pos.x, pos.y);
    else await page.mouse.click(pos.x, pos.y);
  } else {
    const chip = page.locator(`#queue .boat-chip[data-boat="${boatId}"]`);
    await expect(chip, 'wartendes Boot fehlt in der Warteliste unten').toBeVisible();
    await press(chip, testInfo);
  }
  // 3. Knopf zum Einfahren: am Boot (.hm-einfahren, game.gesten.einfahrenAmBoot) oder in der Karte
  //    "Automatisch einfahren" (#card). Beides weist den besten freien Platz zu.
  const amBoot = page.locator('.hm-einfahren');
  const inKarte = page.locator('#card').getByRole('button', { name: /einfahren/i });
  const knopf = amBoot.or(inKarte).first();
  await expect(knopf, 'nach dem Antippen erscheint kein Knopf zum Einfahren (am Boot oder in der Karte)').toBeVisible();
  await expect(knopf).toBeEnabled();
  await press(knopf, testInfo);
  await expect.poll(
    () => page.evaluate((id) => window.hafenmeister.sim.state.boats[id]?.status, boatId),
    { message: 'Boot liegt nach "Automatisch einfahren" nicht am Platz' },
  ).toBe('moored');
  await page.evaluate(() => window.hafenmeister.setPaused(false));

  // 4. Abends erscheint "Kassieren", Antippen bringt das Hafengeld
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
