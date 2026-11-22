// Jugendtraining am Segelclub (P39, docs/jugendtraining.md): Meldung im Meldeplatz, Box geben, Trainerboot
// in der Box, Gruppe läuft über den Slip aus, Meldung liegt nie über Zeit, Kassieren oder Bauen.
import { test, expect } from '../helpers.mjs';

const ueberlappt = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

async function vorbereiten(page) {
  await page.waitForFunction(() => !!window.hafenmeister?.jugendtraining && !!window.hafenmeister.jugendBild, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.einstieg?.beenden?.();
    sim.applyTestStage(g.sim.state, g.sim.ctx, 3);
    g.emit('stufe', 3);
    // Segelclub und Slip gebaut (Spielstand des Services-Moduls)
    const z = (g.sim.state.modules ||= {}).services ||= { gebaut: {}, besuche: {}, summe: {} };
    z.gebaut.segelclub = 1;
    z.gebaut.slip = 1;
    g.services?.neuZeichnen?.();
  });
}

test('Jugendtraining: Frage, Box geben, Trainerboot legt an, Gruppe läuft aus', async ({ game }) => {
  test.setTimeout(120_000);
  const { page } = game;
  await vorbereiten(page);
  await page.evaluate(() => window.hafenmeister.jugendtraining.ausloesen({ beginnIn: 25 }));
  const meldung = page.locator('#hm-jugend');
  await expect(meldung).toBeVisible({ timeout: 15_000 });
  await expect(meldung).toContainText('Heute Jugendtraining');
  await expect(meldung.locator('.hm-primaer')).toContainText('Box');

  const m = await meldung.boundingBox();
  const mr = { left: m.x, top: m.y, right: m.x + m.width, bottom: m.y + m.height };
  for (const sel of ['#hm-zeit', '#btn-build', '#btn-collect']) {
    const el = page.locator(sel);
    if (!(await el.isVisible().catch(() => false))) continue;
    const b = await el.boundingBox();
    expect(ueberlappt(mr, { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height }), `Meldung über ${sel}`).toBeFalsy();
  }

  await meldung.locator('.hm-primaer').click();
  const nach = await page.evaluate(() => {
    const h = window.hafenmeister.jugendtraining.heute();
    return { phase: h?.phase, platz: h?.platz, grund: h?.grund };
  });
  expect(nach.phase, `Grund: ${nach.grund}`).toBe('bereit');
  expect(nach.platz).toBeTruthy();
  await expect(meldung).toContainText(`Box ${nach.platz} für das Trainerboot`);
  // Feste Trainerbox merken
  await meldung.getByText('Immer diese Box').click();
  expect(await page.evaluate(() => window.hafenmeister.jugendtraining.stammbox())).toBe(nach.platz);
  // Das Trainerboot ist im Bild und fährt zur Box
  await expect.poll(() => page.evaluate(() => window.hafenmeister.jugendBild.trainer()?.platz), { timeout: 10_000 }).toBe(nach.platz);
  // Gäste dürfen nicht in die Box
  const gesperrt = await page.evaluate((platz) => {
    const g = window.hafenmeister;
    return g.sim.ctx.hooks.fit.some((f) => f({ state: g.sim.state, ctx: g.sim.ctx, boat: { id: 1, size: 'S' }, berth: g.sim.ctx.berthById[platz] }) === 'jugendtraining');
  }, nach.platz);
  expect(gesperrt).toBeTruthy();

  // Schneller spielen: die Gruppe geht ins Wasser und läuft aus
  await page.evaluate(() => { window.hafenmeister.speed = 3; });
  await expect.poll(() => page.evaluate(() => window.hafenmeister.jugendtraining.heute()?.phase), { timeout: 60_000 }).toBe('draussen');
  const lauf = await page.evaluate(() => ({ z: window.hafenmeister.jugendBild.zustand(), boote: window.hafenmeister.jugendBild.boote().length, rev: window.hafenmeister.jugendBild.revier() }));
  expect(lauf.z).toBeTruthy();
  expect(lauf.boote).toBe(5);
  expect(lauf.rev).toBeTruthy();
  // Sichtbare Boote liegen im Wasser (nicht an Land)
  await expect.poll(() => page.evaluate(() => window.hafenmeister.jugendBild.boote().filter((b) => b.sichtbar).length), { timeout: 30_000 }).toBeGreaterThan(2);
  const anLand = await page.evaluate(() => {
    const g = window.hafenmeister;
    const r = g.jugendBild.rampe();
    return g.jugendBild.boote().filter((b) => b.sichtbar && Math.hypot(b.x - r.oben.x, b.z - r.oben.z) > 30 && !g.fahrwasser.befahrbar(b.x, b.z, 0.5, 0)).length;
  });
  expect(anLand).toBe(0);
});

test('Jugendtraining: Absagen kostet nichts, ohne Segelclub keine Frage', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.jugendtraining, null, { timeout: 30_000 });
  // Ohne Segelclub und Slip kommt nichts
  const ohne = await page.evaluate(() => window.hafenmeister.jugendtraining.ausloesen());
  expect(ohne).toBeNull();
  await vorbereiten(page);
  await page.evaluate(() => window.hafenmeister.jugendtraining.ausloesen({ beginnIn: 60 }));
  const meldung = page.locator('#hm-jugend');
  await expect(meldung).toBeVisible({ timeout: 15_000 });
  const geld = await page.evaluate(() => window.hafenmeister.sim.state.money);
  await meldung.getByText('Absagen').click();
  await expect(meldung).toContainText('abgesagt');
  const nach = await page.evaluate(() => ({ phase: window.hafenmeister.jugendtraining.heute()?.phase, geld: window.hafenmeister.sim.state.money }));
  expect(nach.phase).toBe('ausgefallen');
  expect(nach.geld).toBeGreaterThanOrEqual(geld);
});
