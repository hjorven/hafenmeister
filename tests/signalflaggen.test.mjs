// Signalflaggen und Hafenwissen (P49, docs/signalflaggen.md): Hafen-Code, Flaggenbilder, Sammeln im Spielstand.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WUNSCH_FLAGGE, SIGNALBUCH, FLAGGEN_IM_SPIEL, AUSLAUFEN, flaggenRaster, flaggenSvg, flaggeFuer, wunschVon, BREITE, HOEHE, FARBEN,
} from '../web/js/data/signalflaggen.js';
import { WISSEN, ALLES, GRUPPEN, PALETTE, wissenState, sammeln, gesammelt, fortschritt, eintrag } from '../web/js/data/hafenwissen.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { VERSORGUNG_TEXTE, ANGEBOT_TEXTE } from '../web/js/data/wuensche-texte.js';

test('Jeder Wunsch des Spiels hat genau eine eigene Flagge, P bleibt fürs Auslaufen', () => {
  const wuensche = [...Object.keys(ECONOMY.wuensche), ...Object.keys(ECONOMY.angebotWunsch.wuensche), 'ehrenplatz'];
  for (const w of wuensche) assert.ok(flaggeFuer(w), `Wunsch ${w} hat keine Flagge`);
  const buchstaben = Object.values(WUNSCH_FLAGGE).map((d) => d.flagge);
  assert.equal(new Set(buchstaben).size, buchstaben.length, 'eine Flagge für zwei Wünsche');
  assert.ok(!buchstaben.includes(AUSLAUFEN));
  for (const w of Object.keys(WUNSCH_FLAGGE)) assert.ok(VERSORGUNG_TEXTE[w] || ANGEBOT_TEXTE[w], `Wunsch ${w} gibt es in den Texten nicht`);
  assert.equal(flaggeFuer('__proto__'), null);
  assert.equal(flaggeFuer('gibtsnicht'), null);
  assert.equal(wunschVon('W'), 'wc');
  assert.equal(wunschVon(AUSLAUFEN), null);
});

test('Flaggenbilder: volle Raster mit bekannten Farben, A und B mit Schwalbenschwanz', () => {
  for (const b of FLAGGEN_IM_SPIEL) {
    const r = flaggenRaster(b);
    assert.equal(r.length, HOEHE, b);
    for (const z of r) {
      assert.equal(z.length, BREITE, b);
      for (const c of z) assert.ok(c === '.' || FARBEN[c], `${b}: Farbe ${c}`);
    }
    assert.ok(SIGNALBUCH[b]?.name && SIGNALBUCH[b]?.echt, `${b} fehlt im Signalbuch`);
    assert.match(flaggenSvg(b), /^<svg /);
    const leer = r.join('').split('').filter((c) => c === '.').length;
    if (b === 'A' || b === 'B') assert.ok(leer > 0, `${b} ohne Schwalbenschwanz`);
    else assert.equal(leer, 0, `${b} hat Löcher`);
  }
});

test('Hafenwissen: 16-x-16-Bilder, Texte, eindeutige IDs', () => {
  const ids = ALLES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of WISSEN) {
    assert.ok(GRUPPEN.some((g) => g.id === e.gruppe), e.id);
    assert.ok(e.name && e.text && e.wo, e.id);
    assert.equal(e.bild.length, 16, e.id);
    for (const z of e.bild) {
      assert.equal(z.length, 16, e.id);
      for (const c of z) assert.ok(c === '.' || PALETTE[c], `${e.id}: Farbe ${c}`);
    }
  }
  for (const g of GRUPPEN) assert.ok(ALLES.some((e) => e.gruppe === g.id), `Gruppe ${g.id} leer`);
  assert.equal(eintrag('flagge-P').hier.includes('legt gleich ab'), true);
});

test('Sammeln: neu nur einmal, säubert fremde Einträge, Fortschritt zählt', () => {
  const s = { day: 4, stage: 2, modules: { hafenwissen: { gesehen: { warteboje: { tag: 1 }, unsinn: { tag: 2 }, ['__proto__']: 1 }, neu: ['unsinn', 3] } } };
  const m = wissenState(s);
  assert.deepEqual(Object.keys(m.gesehen), ['warteboje']);
  assert.deepEqual(m.neu, []);
  assert.equal(sammeln(s, 'palstek'), true);
  assert.equal(sammeln(s, 'palstek'), false);
  assert.equal(sammeln(s, 'gibtsnicht'), false);
  assert.deepEqual(s.modules.hafenwissen.gesehen.palstek, { tag: 4, stufe: 2 });
  assert.ok(gesammelt(s, 'palstek'));
  const f = fortschritt(s);
  assert.equal(f.gesehen, 2);
  assert.equal(f.gesamt, ALLES.length);
  assert.equal(f.je.knoten.gesehen, 1);
  // ohne Modul-Eintrag (alte Spielstände)
  const alt = { day: 1, stage: 1 };
  assert.equal(fortschritt(alt).gesehen, 0);
  assert.equal(sammeln(alt, 'warteboje'), true);
  assert.deepEqual(alt.modules.hafenwissen.neu, ['warteboje']);
});
