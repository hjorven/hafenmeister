// Der Ort wächst sichtbar mit der Hafenstufe: Dorf vom Kern nach außen, Häuserzeile am Hafenort.
// Beschreibung: docs/wachstum.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { punkt, hafenAbstand } from '../web/js/render/landschaft/gelaende.js';
import { bauflaechen } from '../web/js/render/landschaft/karte.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { setzeBild, setzeFreiQuellen, dorfPlan, dorfWachstum, hafenortZeile, freiAbstand, HAFENORT_ANZAHL, DORF_ANTEIL } from '../web/js/render/landschaft/vielfalt.js';

const schluessel = (h) => `${h.px.toFixed(2)},${h.py.toFixed(2)}`;

test('Jede Stufe hat mindestens die Häuser der vorigen (Dorf und Hafenort)', () => {
  for (const nr of [0, 3, 7, 12]) {
    setzeBild(nr);
    const plan = dorfPlan();
    let dorfVorher = new Set(), ortVorher = new Set();
    for (let s = 1; s <= 6; s++) {
      const dorf = dorfWachstum(plan, s), ort = hafenortZeile(s);
      const d = new Set(dorf.map(schluessel)), o = new Set(ort.map(schluessel));
      for (const k of dorfVorher) assert.ok(d.has(k), `Bild ${nr} Stufe ${s}: Dorfhaus ${k} fehlt wieder`);
      for (const k of ortVorher) assert.ok(o.has(k), `Bild ${nr} Stufe ${s}: Haus am Hafenort ${k} fehlt wieder`);
      if (s > 1) assert.ok(d.size > dorfVorher.size || plan.haeuser.length < 4, `Bild ${nr} Stufe ${s}: Dorf wächst nicht`);
      assert.equal(o.size, HAFENORT_ANZAHL[s]);
      assert.equal(d.size, Math.ceil(plan.haeuser.length * DORF_ANTEIL[s]));
      dorfVorher = d; ortVorher = o;
    }
    assert.equal(dorfWachstum(plan, 6).length, plan.haeuser.length, 'Stufe 6 zeigt das ganze Dorf');
    // Höher wird es nur zur Mitte hin und erst in späteren Stufen
    assert.ok(dorfWachstum(plan, 1).every((h) => h.geschosse === 1));
    assert.ok(Math.max(...dorfWachstum(plan, 6).map((h) => h.geschosse)) === 3 || plan.haeuser.length < 8);
  }
  setzeBild(0);
});

test('Hafenort liegt hinter der Landstraße, nie auf Bauflächen des Hafens', () => {
  setzeFreiQuellen({ polygone: (st) => bauflaechen(st).map((f) => f.poly) });
  for (let s = 1; s <= 6; s++) {
    for (const h of hafenortZeile(s)) {
      const halb = h.breite / 2;
      assert.ok(h.py + halb < -92, `Stufe ${s}: Haus bei (${h.px}, ${h.py}) ragt in die Hafenfläche`);
      assert.ok(hafenAbstand(h.px, h.py + halb, s) >= 4, `Stufe ${s}: Haus bei (${h.px}, ${h.py}) zu nah am Hafen`);
    }
  }
  setzeFreiQuellen({});
});

test('In allen zehn Küstenformen stehen in Stufe 6 genug Häuser am Hafenort an Land', async () => {
  const { FORMEN, formSetzen } = await import('../web/js/render/landschaft/formen.js');
  const r = region('ostsee');
  setzeFreiQuellen({ polygone: (st) => bauflaechen(st).map((f) => f.poly) });
  try {
    for (const F of FORMEN) {
      formSetzen(F.nr);
      setzeBild(0);
      const zeile = hafenortZeile(6);
      const anLand = zeile.filter((h) => {
        const p = punkt(h.px, h.py, 6, r);
        return p.h >= 0.4 && !['wasser', 'sand', 'kliff'].includes(p.typ) && freiAbstand(h.px, h.py, 6) >= 2;
      });
      assert.ok(anLand.length >= zeile.length * 0.4, `Form ${F.nr}: nur ${anLand.length} von ${zeile.length} Plätzen an Land`);
    }
  } finally {
    formSetzen(1);
    setzeBild(0);
    setzeFreiQuellen({});
  }
});
