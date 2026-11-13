// Einstieg (web/js/features/einstieg.js): Reihenfolge der Hinweise ohne Browser prüfen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { naechsterSchritt, erledige, einstiegState, REIHENFOLGE, TEXTE, WILLKOMMEN_SEK, anteilText, HINWEISE, hinweisFuer, merkeHinweis } from '../web/js/features/einstieg.js';

const lage = (x = {}) => ({ bootImBild: false, willkommenSek: 0, abend: false, muenzen: false, bauenSichtbar: true, tafelSichtbar: true, karteOffen: false, ...x });

test('jeder Schritt hat Titel und Text', () => {
  for (const id of REIHENFOLGE) {
    assert.ok(TEXTE[id]?.titel, id);
    assert.ok(TEXTE[id]?.text, id);
  }
});

test('Willkommen bleibt stehen, bis man es lesen konnte und ein Boot im Bild wartet', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage()), 'willkommen');
  assert.equal(naechsterSchritt(e, lage({ bootImBild: true, willkommenSek: 1.5 })), 'willkommen', 'nicht nach 1,5 s weg');
  assert.equal(naechsterSchritt(e, lage({ bootImBild: false, willkommenSek: 30 })), 'willkommen', 'Boot fährt noch an');
  assert.equal(naechsterSchritt(e, lage({ bootImBild: true, willkommenSek: WILLKOMMEN_SEK })), 'anlegen');
});

test('der ganze erste Tag in Reihenfolge, Liegegeld gleich nach dem Anlegen', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage({ bootImBild: true, willkommenSek: 9 })), 'anlegen');
  erledige(e, 'anlegen');
  assert.equal(naechsterSchritt(e, lage({ muenzen: true })), 'muenzen', 'tagsüber, nicht erst abends');
  erledige(e, 'muenzen');
  assert.equal(naechsterSchritt(e, lage({ karteOffen: true })), null, 'nicht über eine offene Karte');
  assert.equal(naechsterSchritt(e, lage()), 'tempo');
  erledige(e, 'tempo');
  assert.equal(naechsterSchritt(e, lage()), 'bauen');
  erledige(e, 'bauen');
  assert.equal(naechsterSchritt(e, lage({ tafelSichtbar: false })), null, 'ohne Tafel kein Hinweis darauf');
  assert.equal(naechsterSchritt(e, lage()), 'ziele');
  erledige(e, 'ziele');
  assert.equal(e.fertig, true);
  assert.equal(naechsterSchritt(e, lage({ bootImBild: true })), null);
});

test('alter Spielstand mit erstem Schritt "sonne" wird übernommen', () => {
  const state = { modules: { einstieg: { fertig: false, erledigt: ['sonne', 'anlegen'] } } };
  const e = einstiegState(state);
  assert.deepEqual([...e.erledigt].sort(), ['anlegen', 'willkommen']);
  assert.equal(naechsterSchritt(e, lage({ muenzen: true })), 'muenzen');
});

test('Spielstand v2 mit Vorspul-Schritt "sonne" heißt jetzt "tempo"', () => {
  const state = { modules: { einstieg: { fertig: false, v2: true, erledigt: ['willkommen', 'anlegen', 'muenzen', 'sonne'] } } };
  const e = einstiegState(state);
  assert.deepEqual([...e.erledigt].sort(), ['anlegen', 'muenzen', 'tempo', 'willkommen']);
  assert.equal(naechsterSchritt(e, lage()), 'bauen');
});

test('Liegegeld-Text nennt den Anteil, den der Hafenmeister abends holt', () => {
  assert.match(TEXTE.muenzen.text, /abends der Hafenmeister, aber nur (die Hälfte|.* Fünftel|.* Viertel|\d+ Prozent)\./);
  assert.match(TEXTE.muenzen.kurz, /abends nur /);
  assert.equal(anteilText(0.5), 'die Hälfte');
  assert.equal(anteilText(0.8), 'vier Fünftel');
  assert.equal(anteilText(0.7), '70 Prozent');
  for (const t of Object.values(TEXTE)) assert.doesNotMatch(t.text + t.kurz, /Sonne/);
});

test('Handy quer: ohne Tafel endet der Einstieg nach Bauen', () => {
  const e = einstiegState({});
  for (const id of ['willkommen', 'anlegen', 'muenzen', 'tempo']) erledige(e, id);
  assert.equal(naechsterSchritt(e, lage({ ohneZiele: true })), 'bauen');
  erledige(e, 'bauen');
  assert.equal(naechsterSchritt(e, lage({ ohneZiele: true })), null);
  assert.equal(e.fertig, true);
});

test('beendet bleibt beendet und liegt im Spielstand', () => {
  const state = {};
  const e = einstiegState(state);
  e.fertig = true;
  assert.equal(naechsterSchritt(e, lage({ bootImBild: true })), null);
  assert.equal(JSON.parse(JSON.stringify(state)).modules.einstieg.fertig, true);
});

test('nach einem Spieltag schließt der Einstieg von selbst', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage({ tag: 14 })), 'willkommen');
  assert.equal(naechsterSchritt(e, lage({ tag: 14, bootImBild: true, willkommenSek: 9 })), 'anlegen');
  assert.equal(naechsterSchritt(e, lage({ tag: 15, bootImBild: true })), null);
  assert.equal(e.fertig, true);
});

test('Hinweise beim ersten Mal: Zuordnung und nur einmal je Spielstand', () => {
  assert.equal(hinweisFuer('sim:turnedAway', { reason: 'patience' }), 'geduld');
  assert.equal(hinweisFuer('sim:turnedAway', { reason: 'queueFull' }), 'voll');
  assert.equal(hinweisFuer('sim:turnedAway', { reason: 'rebuild' }), null, 'Umbau ist kein Fehler des Spielers');
  assert.equal(hinweisFuer('sim:stageReady', { stage: 2 }), 'stufe');
  assert.equal(hinweisFuer('stammgast:neu', {}), 'stammgast');
  for (const id of ['geduld', 'voll', 'stufe', 'stammgast']) {
    assert.ok(HINWEISE[id].titel && HINWEISE[id].text && HINWEISE[id].kurz, id);
  }
  const e = einstiegState({});
  const offen = [];
  assert.equal(merkeHinweis(e, 'geduld', offen), true);
  assert.equal(merkeHinweis(e, 'geduld', offen), false, 'nicht doppelt in der Schlange');
  e.hinweise.push(offen.shift());
  assert.equal(merkeHinweis(e, 'geduld', offen), false, 'schon gesehen');
  assert.equal(merkeHinweis(e, null, offen), false);
});
