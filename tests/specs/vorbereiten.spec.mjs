// Ereignisse zum Vorbereiten (P24, docs/ereignisse.md): Am Tag vor dem Sturm steht eine Karte mit
// "Sturmklar machen". Der Knopf verholt den Gast vom offenen Stirnplatz nach innen und sperrt die
// offenen Plätze. Die Karte liegt nie über der linken Spalte, Zeit, Kassieren oder Bauen.
import { test, expect } from '../helpers.mjs';

const ueberlappt = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('Vorbereiten: Sturmklar machen verholt Gäste nach innen', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.sim && !!window.hafenmeister.vorbereitung, null, { timeout: 15_000 });
  const fall = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.einstieg?.beenden?.();
    g.setPaused(true);
    const st = g.sim.state, ctx = g.sim.ctx;
    sim.applyTestStage(st, ctx, 3);
    g.emit('stufe', 3);
    // Ein Gast auf einem offenen Stirnplatz
    const offen = sim.availableBerths(st, ctx).find((b) => b.exposed && sim.isFree(st, b.id));
    const id = st.nextId++;
    st.boats[id] = { id, typeId: 'S1', size: 'S', kind: 'motor', length: 4, beam: 1.8, draft: 0.4, stationed: false, nights: 2, wishes: [], status: 'waiting', penalty: 0 };
    st.queue.push(id);
    const r = sim.assign(st, ctx, id, offen.id);
    g.sim.dispatch(r.events);
    // Sturm für morgen ankündigen
    const d = st.day;
    g.events.load({ ...g.events.save(), planned: { id: 'sturm', startDay: d + 1, endDay: d + 1, announcedDay: d }, current: null });
    g.emit('event:announce', { event: g.events.planned.event, day: d, startDay: d + 1, endDay: d + 1 });
    return { id, offen: offen.id, ok: r.ok };
  });
  expect(fall.ok).toBe(true);
  // Wichtigere Fenster (Kartenwahl der Tagesziele) zuerst schließen: die Karte wartet dahinter
  await page.evaluate(() => document.querySelector('ul.tz-wahl button')?.click());
  const karte = page.locator('#ev-vorbereiten');
  await expect(karte).toBeVisible({ timeout: 5_000 });
  await expect(karte).toContainText('Sturm');

  // Lage: nicht über der linken Spalte, nicht über Zeit, Kassieren, Bauen
  const lage = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width }; };
    const k = r(document.getElementById('ev-vorbereiten'));
    const andere = [...document.querySelectorAll('#hm-seite > *, #hm-zeit, #btn-collect, #btn-build')]
      .filter((e) => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0)
      .map((e) => ({ id: e.id || e.className, ...r(e) }));
    return { k, andere, breite: innerWidth, hoehe: innerHeight };
  });
  for (const a of lage.andere) expect(ueberlappt(lage.k, a), `Karte liegt über ${a.id}`).toBe(false);
  expect(lage.k.left).toBeGreaterThanOrEqual(0);
  expect(lage.k.right).toBeLessThanOrEqual(lage.breite);

  await karte.getByRole('button', { name: 'Sturmklar machen' }).click();
  const nach = await page.evaluate((f) => {
    const g = window.hafenmeister; const st = g.sim.state; const ctx = g.sim.ctx;
    return { platz: st.boats[f.id]?.berthId, offen: !!ctx.berthById[st.boats[f.id]?.berthId]?.exposed, schild: g.sim.platzZustand(f.offen) };
  }, fall);
  expect(nach.offen, 'Gast liegt jetzt innen').toBe(false);
  expect(nach.platz).not.toBe(fall.offen);
  expect(nach.schild, 'offener Platz ist bis nach dem Sturm gesperrt').toBe('reserviert');
  await expect(karte).toContainText('sturmklar');
});

// P24 Teil 2: Hanse-Woche zwei Tage vorher (große Plätze freihalten), Mittsommer mit Tipp zum Grillplatz
test('Vorbereiten: Hanse-Woche große Plätze freihalten, Mittsommer nennt den Grillplatz', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.sim && !!window.hafenmeister.vorbereitung, null, { timeout: 15_000 });
  await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.einstieg?.beenden?.();
    g.setPaused(true);
    sim.applyTestStage(g.sim.state, g.sim.ctx, 5);
    g.emit('stufe', 5);
    const d = g.sim.state.day;
    g.events.load({ ...g.events.save(), gross: { id: 'hansewoche', startDay: d + 2, endDay: d + 5, announcedDay: d - 8 }, planned: null, current: null });
    g.emit('event:announce', { event: g.events.gross.event, day: d, startDay: d + 2, endDay: d + 5 });
  });
  await page.evaluate(() => document.querySelector('ul.tz-wahl button')?.click());
  const karte = page.locator('#ev-vorbereiten');
  await expect(karte).toBeVisible({ timeout: 5_000 });
  await expect(karte).toContainText('Hanse-Woche');
  await expect(page.locator('#weather-chip')).toContainText('Hanse-Woche');
  await karte.getByRole('button', { name: 'Plätze freihalten' }).click();
  const v = await page.evaluate(() => {
    const g = window.hafenmeister; const h = g.sim.state.modules.vorbereitung.hansewoche;
    return { n: h?.plaetze.length, schild: h && g.sim.platzZustand(h.plaetze[0]) };
  });
  expect(v.n).toBeGreaterThan(0);
  expect(v.schild).toBe('reserviert');
  await expect(karte).toContainText('freigehalten');

  // Mittsommer ohne Grillplatz: die Ankündigung nennt den Grillplatz
  await page.evaluate(() => {
    const g = window.hafenmeister;
    document.querySelector('#ev-vorbereiten button:last-child')?.click();
    const d = g.sim.state.day;
    g.events.load({ ...g.events.save(), gross: null, planned: { id: 'mittsommer', startDay: d + 1, endDay: d + 1, announcedDay: d }, current: null });
    g.emit('event:announce', { event: g.events.planned.event, day: d, startDay: d + 1, endDay: d + 1 });
  });
  await expect(karte).toBeVisible({ timeout: 5_000 });
  await expect(karte).toContainText('Mittsommer');
  await expect(karte).toContainText('Grillplatz');
});
