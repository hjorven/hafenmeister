// Dauerlieger (P01, docs/neue-features.md Abschnitt 3): Ein Dauerlieger, der früher zurück ist und vor dem
// Hafen auf das Umlegen eines Gastes wartet, ist nach dem Speichern und Neuladen (echter Spielstand, kein
// Testmodus) wieder vor dem Hafen zu sehen, und der Hinweis steht wieder oben.
import { test, expect } from '../helpers.mjs';

// Beim Neuladen würde sonst der Service Worker Three.js am Test-Umweg vorbei vom Netz holen
test.use({ serviceWorkers: 'block' });

test('Dauerlieger: wartender Dauerlieger ist nach dem Neuladen wieder da', async ({ game }) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.sim && !!window.hafenmeister.dauerlieger, null, { timeout: 15_000 });
  const fall = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    const d = await import('./js/features/dauerlieger.js');
    g.einstieg?.beenden?.();
    g.setPaused(true);
    const st = g.sim.state, ctx = g.sim.ctx;
    sim.applyTestStage(st, ctx, 2);
    st.testmodus = false;
    for (let i = 0; i < 6; i++) d.neuerBewerber(st, ctx);
    const platz = Object.keys(ctx.berthById).find((id) => {
      const bw = d.bewerberFuer(st, ctx, id)[0];
      if (!bw) return false;
      const r = d.machDauerplatz(st, ctx, id, bw.id);
      if (!r.ok) throw new Error(`bewerberFuer nannte ${bw.id}, machDauerplatz lehnt ab: ${r.reason}`);
      g.sim.dispatch(r.events);
      return true;
    });
    const p = d.dauerState(st).plaetze[platz];
    const boot = st.boats[p.bootId];
    // Der Dauerlieger ist auf Törn ...
    delete st.berths[platz]; delete st.boats[boot.id]; boot.status = 'away';
    // Schon jetzt zurück (nicht von der Spielzeit abhängig: unter Last läuft sie in CI kaum)
    Object.assign(p, { boot, rueckNacht: st.day, frueherUm: Math.max(0, st.clock - 0.01) / ctx.rules.dayLength });
    // ... und ein Gast liegt auf seinem Platz
    const gast = st.nextId++;
    st.boats[gast] = { ...boot, id: gast, stationed: false, dauer: false, bootsname: 'Testgast', nights: 1, wishes: [], status: 'waiting', penalty: 0, besuche: 0 };
    st.queue.push(gast);
    g.sim.dispatch(sim.assign(st, ctx, gast, platz).events);
    // Ein kleiner Regelschritt von Hand: der Dauerlieger merkt, dass sein Platz belegt ist, und wartet
    g.sim.dispatch(sim.tick(st, ctx, 0.05));
    g.setPaused(false);
    if (!d.dauerState(st).plaetze[platz].wartet) throw new Error('Dauerlieger wartet nicht');
    return { platz, dauer: boot.id };
  });
  // (keine async-Funktion: ein Promise wäre immer "wahr")
  await page.waitForFunction(() => Object.values(window.hafenmeister.sim.state.modules.dauer?.plaetze ?? {}).some((p) => p.wartet), null, { timeout: 20_000 });
  await expect(page.locator('#dauer-hinweis')).toBeVisible();
  expect(await page.evaluate(() => window.hafenmeister.spielstand.speichern()), 'Spielstand gespeichert').toBeTruthy();

  await page.reload();
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('done'), null, { timeout: 30_000 });
  await page.waitForFunction(() => !!window.hafenmeister?.dauerlieger && !!window.hafenmeister.boatAnim, null, { timeout: 15_000 });
  const geladen = await page.evaluate(async () => {
    const d = await import('./js/features/dauerlieger.js');
    const st = window.hafenmeister.sim.state;
    return Object.entries(d.dauerState(st).plaetze).filter(([, p]) => p.wartet).map(([id]) => id);
  });
  expect(geladen, 'Der Spielstand kennt den wartenden Dauerlieger').toEqual([fall.platz]);
  await page.waitForFunction((id) => [...window.hafenmeister.boatAnim.boats].some((b) => (b.info?.id ?? b.id) === id), fall.dauer, { timeout: 10_000 });
  await expect(page.locator('#dauer-hinweis')).toBeVisible();
  await expect(page.locator('#dauer-hinweis')).toContainText(fall.platz);
});
