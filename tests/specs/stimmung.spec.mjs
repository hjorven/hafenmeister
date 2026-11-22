// Paket P46 (docs/stimmung.md): ruhiger Abend mit Lichterketten und wärmerer Musik, Noten bei der Serie.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test('Ruhiger Abend: alles kassiert, Lichterketten gehen an', async ({ game }) => {
  test.setTimeout(180_000);
  const { page } = game;
  await page.goto('./?stufe=3&abend=jetzt');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.stimmung, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => { try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {} });
  expect(await page.evaluate(() => window.hafenmeister.stimmung.ketten().birnen)).toBeGreaterThan(20);
  // ?abend=jetzt spult bis kurz vor den Abend
  await page.waitForFunction(() => window.hafenmeister.sim.state.phase === 'evening', null, { timeout: 45_000, polling: 100 });
  await page.evaluate(() => window.hafenmeister.setPaused(true));
  const vorher = await page.evaluate(() => window.hafenmeister.stimmung.stand());
  expect(vorher.abend).toBe(true);
  expect(vorher.gaeste).toBeGreaterThan(0);
  // Solange etwas offen ist, bleibt es dunkel
  if (vorher.offen > 0 || vorher.warten > 0) {
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.hafenmeister.stimmung.an())).toBe(false);
  }
  // Alle Wartenden in eine Box, alles kassieren: in der Pause gehen die Lichter an
  await page.evaluate(() => {
    const g = window.hafenmeister;
    for (const id of [...g.sim.state.queue]) {
      const p = (g.sim.passendePlaetze(id) ?? []).filter((x) => !String(x).includes('+'));
      if (p.length) g.sim.assign(id, p[0]);
    }
    g.sim.collectAll(true);
  });
  await expect.poll(() => page.evaluate(() => window.hafenmeister.stimmung.stand().ruhig), { timeout: 5_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.hafenmeister.stimmung.an()), { timeout: 5_000 }).toBe(true);
  expect(await page.evaluate(() => window.hafenmeister.sim.state.modules.stimmung.ruhigeAbende)).toBe(1);
  // Ton-Modul spielt die warme Abendmusik (auch ohne Ton im Testbrowser steht der Zustand)
  expect(await page.evaluate(() => window.hafenmeister.audio?.state?.ruhig ?? true)).toBe(true);
  // Am nächsten Morgen gehen sie wieder aus
  await page.evaluate(() => { const g = window.hafenmeister; g.setPaused(false); g.sim.fastForward(40); });
  await expect.poll(() => page.evaluate(() => window.hafenmeister.sim.state.phase), { timeout: 10_000 }).toBe('day');
  await expect.poll(() => page.evaluate(() => window.hafenmeister.stimmung.an()), { timeout: 10_000 }).toBe(false);
  expect(await page.evaluate(() => window.hafenmeister.audio?.state?.ruhig ?? false)).toBe(false);
});

test('Serie: passgenau zugewiesen, Noten steigen über der Box auf', async ({ game }) => {
  test.setTimeout(180_000);
  const { page } = game;
  await page.goto('./?stufe=4');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.stimmung, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  const paar = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    for (let n = 0; n < 400; n++) {
      const s = g.sim.state;
      for (const id of s.queue) {
        const boot = s.boats[id];
        if (boot?.status !== 'waiting') continue;
        const pid = sim.fittingBerths(s, g.sim.ctx, id).find((b) => sim.isSnug(s, g.sim.ctx, boot, g.sim.ctx.berthById[b]));
        if (pid) return { id, pid };
      }
      g.sim.fastForward(1);
    }
    return null;
  });
  test.skip(!paar, 'kein passgenauer Platz frei');
  const vorher = await page.evaluate(() => window.hafenmeister.stimmung.serie());
  await page.evaluate(({ id, pid }) => window.hafenmeister.sim.assign(id, pid), paar);
  expect(await page.evaluate(() => window.hafenmeister.stimmung.serie())).toBe((vorher % 3) + 1 === 3 ? 0 : (vorher % 3) + 1);
  await expect(page.locator('#hm-stimmung-noten .hm-stimmung-note').first()).toBeAttached();
  // Die Noten fangen keine Berührungen ab und verschwinden von selbst
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('hm-stimmung-noten')).pointerEvents)).toBe('none');
  await expect(page.locator('#hm-stimmung-noten .hm-stimmung-note')).toHaveCount(0, { timeout: 5_000 });
});
