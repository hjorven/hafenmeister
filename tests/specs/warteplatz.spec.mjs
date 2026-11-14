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

// Ankerfeld wirklich voll: alle Boote fahren hin und liegen am Ende fest, keins haengt unterwegs.
// Die Boote werden ohne Bild mit game.boatAnim.vorspulen vorgespult (Spielregeln angehalten).
test('Ankerfeld voll: alle Boote kommen an ihrem Warteplatz an, keins haengt', async ({ page, problems }, testInfo) => {
  test.skip(testInfo.project.name !== 'pc', 'Regel ohne Bedienung, ein Geraet reicht');
  test.setTimeout(180_000);
  void problems;
  await page.goto('./?stufe=4');
  await page.waitForFunction(() => window.hafenmeister?.boatView && window.hafenmeister?.landscape?.warteplaetze && window.hafenmeister.time > 0.1, null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const G = window.hafenmeister;
    G.setPaused?.(true);
    const anker = G.landscape.warteplaetze.ankerplaetze?.length ?? 0;
    const bojen = G.boatView.bojen().length;
    const n = bojen + anker + 6;
    const ids = [];
    const modelle = ['M1-1', 'S5-2', 'L1-1', 'M2-1'];
    const groessen = ['M', 'S', 'L', 'M'];
    for (let i = 0; i < n; i++) {
      const id = 91000 + i;
      ids.push(id);
      G.emit('boot-kommt', { id, groesse: groessen[i % 4], art: 'segler', modell: modelle[i % 4], palette: i % 4, name: `Test ${i}`, boje: i % Math.max(1, bojen), herkunft: (i * 0.37) % 1 });
    }
    // Vorspulen: hoechstens 40 Spielminuten in Schritten von 0,25 s. Wer noch auf seine Einfahrt
    // wartet (unsichtbar, WaitTask/EinfahrtWarten), zaehlt nicht als Stillstand.
    const fest = (a) => a && a.moored && !a.task && !a.tasks.length;
    let t = 0, laengsterStillstand = 0;
    const still = new Map();
    for (; t < 2400 && !ids.every((id) => fest(G.boatView.boot(id))); t += 0.25) {
      G.boatAnim.vorspulen(0.25);
      for (const id of ids) {
        const a = G.boatView.boot(id);
        if (!a || fest(a) || ['WaitTask', 'EinfahrtWarten'].includes(a.task?.constructor?.name)) { still.delete(id); continue; }
        const s = a.speed < 0.05 ? (still.get(id) ?? 0) + 0.25 : 0;
        still.set(id, s);
        laengsterStillstand = Math.max(laengsterStillstand, s);
      }
    }
    const offen = ids.filter((id) => !fest(G.boatView.boot(id)));
    return { n, anker, bojen, t, offen, laengsterStillstand };
  });
  expect(r.anker, 'Stufe 4 hat Ankerplaetze').toBeGreaterThan(0);
  expect(r.offen, `alle ${r.n} Boote liegen nach ${r.t} s fest`).toEqual([]);
  expect(r.laengsterStillstand, 'kein Boot steht unterwegs laenger als 90 s still').toBeLessThan(90);
});
