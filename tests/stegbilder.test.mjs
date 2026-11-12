// Tests fuer die Stegbilder (web/js/data/stegbilder.js, stegbild.js), ohne Browser.
// Ausfuehren im Repo-Ordner:  node --test tests/stegbilder.test.mjs
// Beschreibung: docs/stegbilder.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAFEN } from '../web/js/data/harbor.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { stegbildSetzen, stegbildWaehlen } from '../web/js/data/stegbild.js';
import { punkt } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { pruefeStegbild, zusammenfassen } from '../tools/stegbilder/pruefen.mjs';

const kopie = (o) => JSON.parse(JSON.stringify(o));
const variante = (nr) => stegbildSetzen(kopie(HAFEN), nr);
const N = STEGBILDER.varianten.length;

test('ohne Browser bleibt HAFEN das Grundbild', () => {
  assert.equal(HAFEN.stegbild?.nr, 0);
});

test('es gibt mindestens 10 Stegbilder', () => {
  assert.ok(N >= 10, `nur ${N} Varianten`);
});

test('jede Variante hat dieselben Plaetze je Stufe wie das Grundbild', () => {
  for (let nr = 1; nr <= N; nr++) {
    const h = variante(nr);
    for (const p of h.plaetze) {
      const g = HAFEN.plaetze.find((q) => q.id === p.id);
      assert.deepEqual(Object.keys(p.lage).sort(), Object.keys(g.lage).sort(), `Variante ${nr} ${p.id}`);
      assert.equal(p.klasse, g.klasse); assert.equal(p.art, g.art);
      if (STEGBILDER.stege.includes(p.steg)) {
        for (const n of ['1', '2', '3', '4', '5']) {
          if (!g.lage[n]) continue;
          assert.ok(STEGBILDER.varianten[nr - 1].stufen[n].lage[p.id], `Variante ${nr} hat keine Lage fuer ${p.id} in Stufe ${n}`);
        }
      }
    }
    for (const n of Object.keys(HAFEN.stufen)) {
      const andere = (st) => st.stege.filter((l) => !STEGBILDER.stege.includes(l.steg));
      assert.deepEqual(andere(h.stufen[n]), andere(HAFEN.stufen[n]), `Variante ${nr} Stufe ${n}: fremde Stege veraendert`);
    }
  }
});

test('jede Variante besteht alle Pruefungen (Ueberlappung, Gasse, Tiefe, Einfahrt) in Stufe 1 bis 5', () => {
  for (let nr = 1; nr <= N; nr++) {
    const fehler = pruefeStegbild(variante(nr), { stege: STEGBILDER.stege, stufen: [1, 2, 3, 4, 5] });
    assert.equal(fehler.length, 0, `Variante ${nr}:\n${zusammenfassen(fehler)}`);
  }
});

test('Gelaende ist an jedem Platz jeder Variante so tief wie in den Daten (Toleranz 0,4 m)', () => {
  const ostsee = region('ostsee');
  for (let nr = 1; nr <= N; nr++) {
    for (const p of variante(nr).plaetze) {
      for (const [stufe, lage] of Object.entries(p.lage)) {
        const soll = p.tiefe?.[stufe];
        if (soll == null) continue;
        const ist = -punkt(lage[0], lage[1], Number(stufe), ostsee).h;
        assert.ok(ist >= soll - 0.4, `Variante ${nr} ${p.id} Stufe ${stufe}: Gelaende ${ist.toFixed(2)} m, Daten ${soll} m`);
      }
    }
  }
});

test('Stufe 6 uebernimmt die Stege der Variante aus Stufe 5', () => {
  if (!HAFEN.stufen['6']) return;
  const h = variante(1);
  const nur = (st) => st.stege.filter((l) => STEGBILDER.stege.includes(l.steg));
  assert.deepEqual(nur(h.stufen['6']), nur(h.stufen['5']));
});

test('Wahl der Variante: URL, Spielstand, alter Spielstand, Test, neues Spiel', () => {
  const speicher = (werte = {}) => ({
    werte, getItem: (k) => (k in werte ? werte[k] : null), setItem(k, v) { werte[k] = String(v); },
  });
  assert.deepEqual(stegbildWaehlen({ url: '?stegbild=3', s: speicher() }), { nr: 3, quelle: 'url' });
  const mitStand = speicher({ 'hafenmeister.spielstand': JSON.stringify({ spiel: { seed: 7, modules: { stegbild: { nr: 5 } } } }) });
  assert.equal(stegbildWaehlen({ url: '', s: mitStand }).nr, 5);
  const alt = speicher({ 'hafenmeister.spielstand': JSON.stringify({ spiel: { seed: 7, modules: {} } }) });
  assert.deepEqual(stegbildWaehlen({ url: '', s: alt }), { nr: 0, quelle: 'alter-spielstand' });
  assert.deepEqual(stegbildWaehlen({ url: '', s: speicher(), webdriver: true }), { nr: 0, quelle: 'test' });
  const neu = speicher();
  const w = stegbildWaehlen({ url: '', s: neu, zufall: () => 0.5, webdriver: false });
  assert.equal(w.quelle, 'neu');
  assert.ok(w.nr >= 1 && w.nr <= N);
  assert.equal(JSON.parse(neu.werte['hafenmeister.stegbild']).nr, w.nr);
  // derselbe Browser ohne Spielstand behaelt die gewuerfelte Variante
  assert.equal(stegbildWaehlen({ url: '', s: neu, webdriver: false }).nr, w.nr);
});
