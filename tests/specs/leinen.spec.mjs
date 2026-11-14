// Festmacherleinen nur an echten Booten (render/boat-anim.js, render/boat-view.js).
// Fund Jorven 14.11.: an freien Gastplaetzen hingen Leinen von den Pfaehlen zum Steg, als laege dort
// ein unsichtbares Boot. Ursache: ein ankommendes Boot wartet unsichtbar auf seine Einfahrt
// (EinfahrtWarten). Wurde es in dieser Zeit zugewiesen (Selbst-Einfahren, Hafenbuero, Laden,
// Stufenaufstieg), brach der neue Befehl das Warten ab und das Modell blieb fuer immer unsichtbar,
// die Leinen aber nicht.
import { test, expect } from '../helpers.mjs';

const BEREIT = () => window.hafenmeister?.boatView && window.hafenmeister?.sim?.state && window.hafenmeister.time > 0.1;

// Liefert alle Boote mit sichtbaren Leinen, die kein sichtbares, echtes Boot sind.
// Laeuft im Browser als Ticker, damit auch kurze Zustaende auffallen.
function pruefer() {
  const G = window.hafenmeister;
  const W = window.__leinen = { funde: [], gesehen: new Set(), n: 0, tage: new Set() };
  G.onTick((dt) => {
    if (!dt) return;
    const S = G.sim, st = S?.state;
    if (!st) return;
    // wie ein Spieler: jede Muenze sofort einstreichen, damit der Hafen voll laeuft
    for (const b of Object.values(st.boats)) if (b.pendingFee > 0) S.collect(b.id);
    W.tage.add(st.day);
    if (++W.n % 3) return;
    for (const a of G.boatAnim.boats) {
      if (!a.lines.length || !a.lineObj.visible) continue;
      const grund = [];
      if (a.model.visible === false) grund.push('Boot unsichtbar');
      if (!a.model.parent) grund.push('Boot nicht in der Szene');
      if (G.boatView.boot(a.id) !== a) grund.push('Boot gehoert zu keinem Spielboot');
      if (!a.berth) grund.push('Leinen ohne Liegeplatz');
      const art = String(a.berth?.id ?? '');
      // fest in einer Box, ohne Auftrag (legt nicht gerade ab), aber die Spielregeln kennen es nicht
      if (a.moored && !a.task && !a.tasks.length && art && !art.startsWith('boje') && !art.startsWith('anker')) {
        const geht = Object.values(st.leaving || {}).some((l) => String(l.boatId) === String(a.id));
        if (!st.boats[a.id] && !geht) grund.push('Spielregeln kennen das Boot nicht');
      }
      if (!grund.length) continue;
      const k = `${a.id}|${grund.join()}`;
      if (W.gesehen.has(k)) continue;
      W.gesehen.add(k);
      W.funde.push(`Boot ${a.id} an ${art || '-'} (Tag ${st.day}, ${a.state}): ${grund.join(', ')}`);
    }
  });
}

test.describe('Festmacherleinen', () => {
  test.skip(({ projekt }) => projekt !== 'pc', 'Regel ohne Bedienung, ein Geraet reicht');

  test('Zuweisen, waehrend das Boot noch unsichtbar auf die Einfahrt wartet: Boot wird sichtbar, Leinen nur mit Boot', async ({ page, problems }) => {
    void problems;
    await page.goto('./?stufe=2');
    await page.waitForFunction(BEREIT, null, { timeout: 30_000 });
    const r = await page.evaluate(() => {
      const G = window.hafenmeister;
      G.setPaused?.(true);
      const zustaende = G.sim.platzZustaende();
      const frei = Object.keys(zustaende).filter((id) => zustaende[id] === 'frei');
      const info = (id) => ({ id, groesse: 'S', art: 'motor', modell: 'S1-1', palette: 0, name: `Test ${id}`, boje: 0, herkunft: 0.5 });
      // Viele Ankuenfte zugleich: die spaeteren warten gestaffelt unsichtbar am Startpunkt
      const ids = [96000, 96001, 96002, 96003, 96004, 96005];
      for (const id of ids) G.emit('boot-kommt', info(id));
      G.boatAnim.vorspulen(0.5);
      const versteckt = ids.filter((id) => G.boatView.boot(id)?.model.visible === false);
      // a) zugewiesen (wie Selbst-Einfahren oder Hafenbuero)
      const a = versteckt[versteckt.length - 1];
      G.emit('boot-zugewiesen', { id: a, platz: frei[0] });
      // b) sofort festgelegt (wie Laden oder Stufenaufstieg)
      const b = versteckt[versteckt.length - 2];
      const bootB = G.boatView.boot(b);
      bootB.moorAt(G.boatView.boot(ids[0]).berth ?? { x: bootB.x, z: bootB.z, heading: 0, kind: 'buoy', deck: 0.5 });
      const sofortB = { sichtbar: bootB.model.visible, leinen: bootB.lineObj.visible || bootB.lines.length > 0 };
      for (let t = 0; t < 900 && !G.boatView.boot(a).moored; t += 0.25) G.boatAnim.vorspulen(0.25);
      G.boatAnim.vorspulen(1);
      const bootA = G.boatView.boot(a);
      return {
        versteckt: versteckt.length,
        a: { fest: bootA.moored, platz: bootA.berth?.id, sichtbar: bootA.model.visible, leinen: bootA.lineObj.visible },
        b: { sichtbar: bootB.model.visible, sofort: sofortB },
        ohneBoot: [...G.boatAnim.boats].filter((x) => x.lineObj.visible && x.model.visible === false).map((x) => x.id),
      };
    });
    expect(r.versteckt, 'mindestens zwei Boote warten unsichtbar auf die Einfahrt').toBeGreaterThanOrEqual(2);
    expect(r.a.fest, 'das zugewiesene Boot liegt am Ende fest').toBe(true);
    expect(r.a.sichtbar, 'das zugewiesene Boot ist sichtbar').toBe(true);
    expect(r.a.leinen, 'seine Leinen sind zu sehen').toBe(true);
    expect(r.b.sofort.sichtbar, 'sofort festgelegtes Boot ist sofort sichtbar').toBe(true);
    expect(r.ohneBoot, 'keine Leinen an unsichtbaren Booten').toEqual([]);
  });

  // Viele Spieltage im Zeitraffer auf jedem Kuestentyp (abwechselnd Stufe 3 und 6, Boote fahren
  // selbst ein, Muenzen werden sofort eingestrichen): nirgends Leinen ohne sichtbares Boot.
  for (let g = 1; g <= 10; g++) {
    const stufe = g % 2 ? 3 : 6;
    test(`Kuestentyp ${g}, Stufe ${stufe}: ueber viele Tage keine Leinen ohne Boot`, async ({ page, problems }) => {
      void problems;
      test.setTimeout(120_000);
      await page.goto(`./?stufe=${stufe}&gelaende=${g}&testtempo=300`);
      await page.waitForFunction(BEREIT, null, { timeout: 45_000 });
      await page.evaluate(pruefer);
      // mindestens 6 Spieltage, hoechstens 50 s Echtzeit
      await page.waitForFunction(() => window.__leinen.tage.size >= 7, null, { timeout: 50_000 }).catch(() => {});
      const r = await page.evaluate(() => ({ tage: window.__leinen.tage.size, funde: window.__leinen.funde.slice(0, 10) }));
      expect(r.tage, 'genug Spieltage gelaufen').toBeGreaterThanOrEqual(4);
      expect(r.funde, 'keine Leinen ohne Boot').toEqual([]);
    });
  }
});
