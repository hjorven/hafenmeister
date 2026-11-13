// Warteplaetze (web/js/render/boat-view.js, warteplatz): kommen mehr Boote, als Bojen und passende
// Ankerplaetze frei sind, bekommt jedes trotzdem einen Platz im Ankerbereich, ohne Skriptfehler.
// Fund aus dem Zeitraffer: ein inneres "const k" ueberdeckte den Ankerzaehler, sobald alle
// passenden Ankerplaetze belegt waren ("Assignment to constant variable"), das Boot blieb ohne Platz.
import { test, expect } from '../helpers.mjs';

test('Alle Bojen und Ankerplaetze belegt: weitere Boote ankern trotzdem', async ({ page, problems }, testInfo) => {
  test.skip(testInfo.project.name !== 'pc', 'Regel ohne Bedienung, ein Geraet reicht');
  void problems;   // meldet Skriptfehler am Ende (helpers.mjs)
  await page.goto('./?stufe=4');
  await page.waitForFunction(() => window.hafenmeister?.boatView && window.hafenmeister?.landscape?.warteplaetze && window.hafenmeister.time > 0.1, null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const G = window.hafenmeister;
    G.setPaused?.(true);
    const anker = G.landscape.warteplaetze.ankerplaetze?.length ?? 0;
    const bojen = G.boatView.bojen().length;
    const n = bojen + anker + 6;
    const fehler = [];
    for (let i = 0; i < n; i++) {
      try {
        G.emit('boot-kommt', { id: 90000 + i, groesse: 'M', art: 'segler', modell: 'M1-1', palette: i % 4, name: `Test ${i}`, boje: i % Math.max(1, bojen), herkunft: (i * 0.37) % 1 });
      } catch (e) { fehler.push(String(e?.message ?? e)); }
    }
    const ohnePlatz = [];
    for (let i = 0; i < n; i++) {
      const a = G.boatView.boot(90000 + i);
      if (!a || !(a.berth || a.reserviert || a.task || a.tasks?.length)) ohnePlatz.push(90000 + i);
    }
    return { n, anker, bojen, fehler, ohnePlatz };
  });
  expect(r.anker, 'Stufe 4 hat Ankerplaetze').toBeGreaterThan(0);
  expect(r.fehler, 'boot-kommt wirft keinen Fehler').toEqual([]);
  expect(r.ohnePlatz, `alle ${r.n} Boote haben einen Warteplatz oder fahren hin`).toEqual([]);
});
