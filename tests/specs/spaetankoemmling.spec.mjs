// Paket P53 (docs/spaetankoemmling.md): Spätankömmling läuft nachts mit Lampe ein, die Nacht wartet auf ihn.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test('Spätankömmling: Meldung, Lampe im Dunkeln, Box mit Schein, Nacht wartet, Kajütlicht', async ({ game }) => {
  test.setTimeout(400_000);
  const { page } = game;
  await page.goto('./?stufe=3&spaet=jetzt');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.spaet, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => { try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {} });
  // ?spaet=jetzt plant ihn für heute und spult bis kurz vor den Abend
  await page.waitForFunction(() => window.hafenmeister.spaet.boot()?.spaet === window.hafenmeister.sim.state.day, null, { timeout: 45_000, polling: 100 });
  const tag = await page.evaluate(() => window.hafenmeister.sim.state.day);
  const id = await page.evaluate(() => window.hafenmeister.spaet.boot().id);
  // Mitschreiben, was im Bild zu sehen war (Lampe, Schein an der Box)
  await page.evaluate((id) => {
    const g = window.hafenmeister;
    window.__spaet = { lampe: false, schein: false };
    setInterval(() => { if (g.spaet.lampe(id)) window.__spaet.lampe = true; if (g.spaet.schein()) window.__spaet.schein = true; }, 50);
  }, id);
  // Er läuft erst am Abend ein und wird gemeldet
  await page.waitForFunction(() => window.hafenmeister.spaet.boot()?.status === 'waiting', null, { timeout: 90_000, polling: 200 });
  expect(await page.evaluate(() => window.hafenmeister.sim.state.phase)).toBe('evening');
  await page.waitForFunction(() => !!window.hafenmeister.spaet.meldung(), null, { timeout: 90_000, polling: 200 });
  await expect(page.locator('#hm-spaet')).toContainText('Spätankömmling');
  // Zuweisen von Hand: an der Box liegt ein Schein, bis er fest ist
  await page.evaluate((id) => {
    const g = window.hafenmeister;
    const p = (g.sim.passendePlaetze(id) ?? []).filter((x) => !String(x).includes('+'));
    g.sim.assign(id, p[0]);
  }, id);
  // Die Nacht wartet: der Morgen kommt erst, wenn er fest ist
  await page.waitForFunction(() => window.hafenmeister.sim.nachtHalt() > 0, null, { timeout: 120_000, polling: 200 });
  expect(await page.evaluate(() => window.hafenmeister.sim.state.day)).toBe(tag);
  expect(await page.evaluate(() => window.hafenmeister.sim.tagesAnteil())).toBeLessThan(1);
  await page.waitForFunction((id) => window.hafenmeister.spaet.kajuete(id) || window.hafenmeister.sim.state.day !== window.hafenmeister.spaet.boot()?.spaet, id, { timeout: 120_000, polling: 100 });
  const b = await page.evaluate((id) => window.hafenmeister.sim.state.boats[id], id);
  expect(b.status).toBe('moored');
  expect(b.spaetDank).toBe(true);
  // Im Dunkeln brannte die Taschenlampe, an der Box lag der Schein
  expect(await page.evaluate(() => window.__spaet)).toEqual({ lampe: true, schein: true });
  // Danach kommt der Morgen
  await page.waitForFunction((tag) => window.hafenmeister.sim.state.day === tag + 1, tag, { timeout: 60_000, polling: 200 });
  expect(await page.evaluate(() => window.hafenmeister.sim.nachtHalt())).toBe(0);
});
