// Hafentiere (Paket P51, docs/hafentiere.md): Spielstand, Logbuch-Zählung und Erfolg ohne Browser.
// Das Verhalten im Bild (render/hafentiere.js) prüft tests/specs/hafentiere.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../web/js/state.js';
import * as R from '../web/js/features/besucher-regeln.js';
import * as E from '../web/js/features/erfolge-daten.js';
import { HAFENTIERE, HAFENTIER_TEXTE, MOTIVE, ALLE_MOTIVE, istTier, istHafentier, texteVon } from '../web/js/data/besucher.js';

function neu(stufe = 3) {
  const state = createState({ seed: 11 });
  state.stage = stufe;
  state.day = 4;
  return state;
}

test('Texte: drei Hafentiere mit Titel, Artikel, Stufe, Satz, Chronik und Hinweis', () => {
  assert.deepEqual(HAFENTIERE, ['katze', 'hund', 'reiher']);
  for (const a of HAFENTIERE) {
    const t = HAFENTIER_TEXTE[a];
    for (const k of ['titel', 'artikel', 'kommt', 'chronik', 'hinweis']) assert.ok(typeof t[k] === 'string' && t[k].length > 1, `${a}.${k}`);
    assert.ok(Number.isInteger(t.stufe) && t.stufe >= 1 && t.stufe <= 6);
    assert.equal(texteVon(a), t);
    assert.ok(istHafentier(a));
    assert.ok(!istTier(a), 'Hafentiere zählen nicht als seltene Tiere');
    assert.ok(!MOTIVE.includes(a), 'das Fotoalbum bleibt bei den seltenen Besuchern');
    assert.ok(ALLE_MOTIVE.includes(a));
  }
  assert.equal(HAFENTIER_TEXTE.hund.stufe, 2, 'den Hund gibt es erst mit dem Hafenbüro');
});

test('Gesehen höchstens einmal je Tag, an mehreren Tagen gezählt', () => {
  const state = neu();
  assert.equal(R.hafentierGesehen(state, 'katze'), true);
  assert.equal(R.hafentierGesehen(state, 'katze'), false);
  assert.equal(R.besState(state).gesehen.katze.mal, 1);
  assert.ok(R.besState(state).neu.includes('katze'));
  state.day = 5;
  assert.equal(R.hafentierGesehen(state, 'katze'), false, 'nicht mehr neu');
  assert.equal(R.besState(state).gesehen.katze.mal, 2);
  assert.equal(R.besState(state).gesehen.katze.tag, 4, 'erster Tag bleibt');
  assert.equal(R.hafentierGesehen(state, 'drache'), false);
  assert.equal(R.hafentierGesehen(state, 'schwaene'), false, 'seltene Tiere laufen über tierGesehen');
});

test('Fotos, Fortschritt und Erfolg Hafenfreunde; Fotoalbum zählt sie nicht', () => {
  const state = neu();
  const erreicht = () => Object.keys(E.erfolgeState(state).erreicht);
  E.pruefen(state);
  assert.ok(!erreicht().includes('hafenfreunde'));
  assert.equal(R.fotoMerken(state, 'katze', 'data:image/jpeg;base64,KKKK'), true);
  assert.equal(R.fotoMerken(state, 'katze', null), false);
  assert.equal(R.besState(state).fotos.katze.bild, 'data:image/jpeg;base64,KKKK');
  R.fotoMerken(state, 'hund');
  E.pruefen(state);
  assert.ok(!erreicht().includes('hafenfreunde'), 'Reiher fehlt');
  R.fotoMerken(state, 'reiher');
  E.pruefen(state);
  assert.ok(erreicht().includes('hafenfreunde'));
  assert.ok(!erreicht().includes('fotoalbum'));
  assert.ok(!erreicht().includes('tierfreund'));
  const f = R.fortschritt(state);
  assert.deepEqual([f.gesehen, f.fotos, f.gesamt, f.hafentiere, f.hafentierFotos, f.hafentiereGesamt, f.tierFotos], [0, 0, 6, 3, 3, 3, 0]);
  const hf = E.ERFOLGE.find((e) => e.id === 'hafenfreunde');
  assert.equal(hf.gruppe, 'sammeln');
});

test('Speichern und Laden; geladene Stände behalten Hafentiere, Unsinn fliegt raus', () => {
  const state = neu();
  R.hafentierGesehen(state, 'reiher');
  R.fotoMerken(state, 'reiher', 'data:image/jpeg;base64,RRRR');
  const zurueck = deserialize(serialize(state));
  R.saeubern(zurueck);
  assert.deepEqual(zurueck.modules.besucher.gesehen.reiher, state.modules.besucher.gesehen.reiher);
  assert.equal(zurueck.modules.besucher.fotos.reiher.bild, 'data:image/jpeg;base64,RRRR');
  zurueck.modules.besucher.gesehen.katze = { tag: 'x', mal: 0, zuletzt: 'gestern' };
  zurueck.modules.besucher.gesehen.papagei = { tag: 1 };
  zurueck.modules.besucher.fotos.hund = { tag: 2, bild: 'javascript:alert(1)' };
  zurueck.modules.besucher.neu = ['hund', 'papagei', 'hund'];
  R.saeubern(zurueck);
  const s = zurueck.modules.besucher;
  assert.deepEqual(s.gesehen.katze, { tag: null, stufe: null, mal: 1 });
  assert.ok(!('papagei' in s.gesehen));
  assert.deepEqual(s.fotos.hund, { tag: 2 });
  assert.deepEqual(s.neu, ['hund']);
  // Ein Stand von vor P51 (ohne Hafentiere) lädt unverändert
  const alt = neu();
  R.fotoMerken(alt, 'schwaene');
  const vorher = JSON.stringify(alt.modules.besucher);
  R.saeubern(alt);
  assert.equal(JSON.stringify(alt.modules.besucher), vorher);
});
