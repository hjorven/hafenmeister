// Leinen annehmen (P48, docs/leinen.md), echt bedient mit Maus oder Finger:
// Ein Gast fährt in seine Box, am Steg steht das Tau-Symbol. Antippen: Festmacher steht am Steg,
// das Boot macht fest, die Crew gibt Trinkgeld (Tagesbericht liegegeld.leinen). Ohne Antippen macht
// die Crew selbst fest und es gibt nichts. An Bojen gibt es nie ein Symbol.
import { test, expect, isTouchProject, ohneEinstieg } from '../helpers.mjs';

test.skip(({ projekt }) => projekt !== 'handy' && projekt !== 'pc', 'Bedienung am Handy und am PC geprüft');

async function hafen(page) {
  await page.goto('./?stufe=2');
  await page.waitForFunction(() => window.hafenmeister?.sim?.state && window.hafenmeister.leinen && window.hafenmeister.time > 0.3,
    null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    const g = window.hafenmeister;
    window.__leinen = { ereignisse: [], bojen: [] };
    for (const n of ['leinen:angeboten', 'leinen:angenommen', 'leinen:trinkgeld']) g.on(n, (d) => window.__leinen.ereignisse.push({ n, ...d }));
    // an keiner Boje und keinem Ankerplatz darf je ein Symbol stehen
    g.onTick(() => { for (const a of g.leinen.angebote()) if (/^(boje|anker|BF)/.test(String(a.platz))) window.__leinen.bojen.push(a.platz); });
  });
}

// Ein Gast, der an der Boje liegt, bekommt eine freie Box; Kamera schaut auf die Box
async function gastInBox(page, ausser = []) {
  await page.evaluate(() => { window.hafenmeister.speed = 8; window.hafenmeister.setPaused?.(false); });
  await page.waitForFunction((ausser) => {
    const g = window.hafenmeister;
    return g.sim.waitingBoats().some((w) => !ausser.includes(w.id) && g.boatView.boot(w.id)?.moored);
  }, ausser, { timeout: 120_000, polling: 200 });
  const r = await page.evaluate((ausser) => {
    const g = window.hafenmeister;
    g.speed = 1;
    const w = g.sim.waitingBoats().find((b) => !ausser.includes(b.id) && g.boatView.boot(b.id)?.moored);
    const z = g.sim.platzZustaende();
    // die nächste freie Box zuerst: kurzer Weg, wenig Verkehr dazwischen
    const boot = g.boatView.boot(w.id);
    const lage = (id) => g.stege?.platz?.(id)?.mesh?.getWorldPosition?.(new g.THREE.Vector3()) ?? { x: 0, z: 0 };
    const frei = Object.keys(z).filter((id) => z[id] === 'frei' && !/^(boje|anker|BF)/.test(id))
      .sort((a, b) => Math.hypot(lage(a).x - boot.x, lage(a).z - boot.z) - Math.hypot(lage(b).x - boot.x, lage(b).z - boot.z));
    for (const id of frei) {
      if (g.sim.assign(w.id, id)?.ok) {
        const pos = lage(id);
        const c = g.camera;
        c.stop?.();
        c._fly = null;
        c.target.set(pos.x, 0, pos.z);
        c.setPitch?.(60, { sofort: true });
        c.viewWidth = 60;
        c.zoomAt(1);
        return { id: w.id, platz: id };
      }
    }
    return null;
  }, ausser);
  expect(r, 'kein Gast bekam eine freie Box').not.toBeNull();
  return r;
}

test('Leine annehmen: Symbol am Steg antippen, Festmacher steht da, Crew gibt Trinkgeld', async ({ page, problems }) => {
  test.setTimeout(360_000);
  void problems;
  await hafen(page);
  const { id, platz } = await gastInBox(page);
  // Symbol erscheint, solange das Boot heranfährt
  await page.waitForFunction((id) => window.hafenmeister.leinen.angebote().some((a) => a.boot === id && a.sichtbar),
    id, { timeout: 120_000, polling: 100 }).catch(async (err) => {
    const lage = await page.evaluate((id) => {
      const g = window.hafenmeister, a = g.boatView.boot(id), c = g.camera;
      return { state: a?.state, task: a?.task?.constructor?.name, x: a?.x, z: a?.z, berth: a?.berth?.id, moored: a?.moored, angebote: g.leinen.angebote(),
        kamera: [c.target.x, c.target.z, c.viewWidth], ereignisse: window.__leinen.ereignisse, body: document.body.className, tag: g.sim.state.day, phase: g.sim.state.phase };
    }, id);
    throw new Error(`${err.message}\n${JSON.stringify(lage)}`);
  });
  const vorher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  const knopf = page.locator('.hm-festmacher:not([hidden])').first();
  await expect(knopf).toBeVisible();
  if (isTouchProject(test.info())) await knopf.tap(); else await knopf.click();
  await page.waitForFunction((id) => window.__leinen.ereignisse.some((e) => e.n === 'leinen:angenommen' && e.boot === id), id, { timeout: 5_000 });
  // Festmacher steht in der Szene
  expect(await page.evaluate(() => window.hafenmeister.scene.children.filter((o) => o.name === 'festmacher').length)).toBeGreaterThan(0);
  // Boot macht fest, Trinkgeld kommt in die Kasse
  await page.waitForFunction((id) => window.__leinen.ereignisse.some((e) => e.n === 'leinen:trinkgeld' && e.boot === id), id, { timeout: 150_000, polling: 100 })
    .catch(async (err) => {
      const lage = await page.evaluate((id) => {
        const a = window.hafenmeister.boatView.boot(id);
        return { state: a?.state, task: a?.task?.constructor?.name, x: a?.x, z: a?.z, berth: a?.berth?.id, speed: window.hafenmeister.speed, ereignisse: window.__leinen.ereignisse };
      }, id);
      throw new Error(`${err.message}\n${JSON.stringify(lage)}`);
    });
  const r = await page.evaluate(({ id, platz }) => {
    const g = window.hafenmeister;
    const t = window.__leinen.ereignisse.find((e) => e.n === 'leinen:trinkgeld' && e.boot === id);
    return { betrag: t.betrag, platz: t.platz, geld: g.sim.state.money, bericht: g.sim.tagesbericht().details?.liegegeld?.leinen ?? 0, fest: g.boatView.boot(id).moored, soll: platz };
  }, { id, platz });
  expect(r.betrag).toBeGreaterThan(0);
  expect(r.fest).toBe(true);
  expect(String(r.soll).startsWith(String(r.platz))).toBe(true);
  expect(r.bericht).toBeGreaterThanOrEqual(r.betrag);
  expect(r.geld).toBeGreaterThanOrEqual(vorher + r.betrag);
  // Ein zweites Antippen bringt nichts mehr, Symbol und Festmacher gehen
  expect(await page.evaluate((id) => window.hafenmeister.leinen.annehmen(id), id)).toBe(false);
  await page.waitForFunction(() => !window.hafenmeister.scene.children.some((o) => o.name === 'festmacher'), null, { timeout: 10_000 });
  expect(await page.evaluate(() => window.__leinen.bojen)).toEqual([]);
});

test('Ohne Antippen macht die Crew selbst fest, kein Trinkgeld', async ({ page, problems }) => {
  test.setTimeout(360_000);
  void problems;
  await hafen(page);
  const { id } = await gastInBox(page);
  await page.waitForFunction((id) => window.hafenmeister.boatView.boot(id)?.moored && window.hafenmeister.boatView.boot(id)?.berth?.kind !== 'buoy',
    id, { timeout: 90_000, polling: 100 });
  const r = await page.evaluate((id) => ({
    angeboten: window.__leinen.ereignisse.some((e) => e.n === 'leinen:angeboten' && e.boot === id),
    trinkgeld: window.__leinen.ereignisse.filter((e) => e.n === 'leinen:trinkgeld').length,
    offen: window.hafenmeister.leinen.angebote().filter((a) => a.boot === id).length,
    bericht: window.hafenmeister.sim.tagesbericht().details?.liegegeld?.leinen ?? 0,
  }), id);
  expect(r.angeboten, 'Symbol wurde für das Boot angeboten').toBe(true);
  expect(r.trinkgeld).toBe(0);
  expect(r.bericht).toBe(0);
  expect(r.offen).toBe(0);
  expect(await page.evaluate(() => window.__leinen.bojen)).toEqual([]);
});
