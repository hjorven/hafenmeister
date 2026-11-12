// Einstieg (web/js/features/einstieg.js): Reihenfolge der Hinweise ohne Browser prüfen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { naechsterSchritt, erledige, einstiegState, REIHENFOLGE, TEXTE, WILLKOMMEN_SEK } from '../web/js/features/einstieg.js';

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
  assert.equal(naechsterSchritt(e, lage()), 'sonne');
  erledige(e, 'sonne');
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
