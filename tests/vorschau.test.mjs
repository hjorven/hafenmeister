// Wünsche über dem Boot und Funk-Vorschau (docs/vorschau.md): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { WUNSCH, wunschName, umrissRaster, umrissMasse, uhrzeitText, funkDaten, funkFrei, funkSatz, bootArt } from '../web/js/ui/vorschau.js';

function neu(stufe = 3) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const state = createState({ seed: 5 });
  state.stage = stufe;
  sim.tick(state, ctx, 0);
  return { ctx, state };
}

test('jeder Wunsch der Spielzahlen hat ein Symbol mit 12 x 12 Raster', () => {
  for (const key of Object.keys(ECONOMY.wuensche)) {
    const w = WUNSCH[key];
    assert.ok(w, `Symbol für ${key}`);
    assert.equal(w.raster.length, 12);
    for (const z of w.raster) assert.equal(z.length, 12, `${key}: ${z}`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(w.farbe));
  }
  assert.equal(wunschName('strom'), 'Strom');
  assert.equal(wunschName('neu'), 'neu');
});

test('Umriss: Maße wachsen mit der Bootslänge und bleiben in der Karte', () => {
  let vorher = 0;
  for (const m of [2, 4, 8, 12, 20, 30, 40, 60]) {
    const { L, B } = umrissMasse(m, m / 3);
    assert.ok(L >= vorher, `Länge ${m} m`);
    assert.ok(L <= 34 && B <= 11 && B >= 3 && B % 2 === 1);
    vorher = L;
  }
  for (const art of ['segel', 'motor', 'klein', 'mehrrumpf', 'traditionssegler']) {
    const r = umrissRaster(art, 12, 4);
    const { L, B } = umrissMasse(12, 4);
    assert.equal(r.length, B + 2);
    assert.ok(r.every((z) => z.length === L + 2));
    assert.ok(r.join('').includes('k') && r.join('').includes('w'), art);
  }
});

test('Bootsart aus Katalog: Segler, Motor, Mehrrumpf', () => {
  const typ = (id) => BOAT_CATALOG.find((t) => t.id === id);
  assert.equal(bootArt({ kind: 'mehrrumpf' }, typ('L2')), 'mehrrumpf');
  assert.equal(bootArt({ kind: 'segelyacht' }, typ('L1')), 'segel');
  assert.equal(bootArt({ kind: 'motoryacht' }, typ('L3')), 'motor');
  assert.equal(bootArt({ kind: 'ruderboot' }, typ('S1')), 'klein');
});

test('Uhrzeit: Ankunft am Nachmittag, auf zehn Minuten gerundet', () => {
  const rules = { dayLength: 90, eveningLength: 30 };
  assert.match(uhrzeitText(0, rules), /^6:30$/);
  const t = uhrzeitText(60, rules);
  assert.match(t, /^1[4-6]:[0-5]0$/);
});

test('Funk erst mit Hafenbüro Stufe 1, zeigt die nächsten Boote mit Wünschen', () => {
  const { ctx, state } = neu(3);
  assert.equal(funkFrei(state, ctx), false);
  state.office = ctx.rules.office.preview;
  assert.equal(funkFrei(state, ctx), true);
  const liste = sim.preview(state, ctx);
  assert.ok(liste.length > 0 && liste.length <= 3);
  const d = funkDaten(state, ctx, liste);
  assert.equal(d.length, liste.length);
  for (let i = 0; i < d.length; i++) {
    assert.equal(d[i].id, liste[i].id);
    assert.deepEqual(d[i].wuensche, liste[i].wishes);
    assert.ok(d[i].zeit === 'gleich' || /^\d{1,2}:\d0$/.test(d[i].zeit));
    assert.ok(funkSatz(d[i]).startsWith(d[i].name));
  }
});
