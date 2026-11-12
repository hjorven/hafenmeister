// Einstieg (web/js/features/einstieg.js): Reihenfolge der Hinweise ohne Browser prüfen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { naechsterSchritt, erledige, einstiegState, REIHENFOLGE, TEXTE } from '../web/js/features/einstieg.js';

const lage = (x = {}) => ({ wartet: false, abend: false, muenzen: false, bauenSichtbar: true, tafelSichtbar: true, karteOffen: false, ...x });

test('jeder Schritt hat Titel und Text', () => {
  for (const id of REIHENFOLGE) {
    assert.ok(TEXTE[id]?.titel, id);
    assert.ok(TEXTE[id]?.text, id);
  }
});

test('neues Spiel: erst Willkommen, mit wartendem Boot dann Anlegen', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage()), 'sonne');
  assert.equal(naechsterSchritt(e, lage({ wartet: true })), 'anlegen');
  assert.ok(e.erledigt.includes('sonne'));
});

test('der ganze erste Tag in Reihenfolge', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage({ wartet: true })), 'anlegen');
  erledige(e, 'anlegen');
  assert.equal(naechsterSchritt(e, lage()), null, 'tagsüber ohne wartendes Boot kein Hinweis');
  assert.equal(naechsterSchritt(e, lage({ abend: true, muenzen: true })), 'muenzen');
  erledige(e, 'muenzen');
  assert.equal(naechsterSchritt(e, lage({ abend: true, karteOffen: true })), null, 'nicht über eine offene Karte');
  assert.equal(naechsterSchritt(e, lage({ abend: true })), 'bauen');
  erledige(e, 'bauen');
  assert.equal(naechsterSchritt(e, lage({ tafelSichtbar: false })), null, 'ohne Tafel kein Hinweis darauf');
  assert.equal(naechsterSchritt(e, lage()), 'ziele');
  erledige(e, 'ziele');
  assert.equal(e.fertig, true);
  assert.equal(naechsterSchritt(e, lage({ wartet: true })), null);
});

test('Abend ohne Münzen zeigt nichts, am nächsten Tag geht es weiter', () => {
  const e = einstiegState({});
  assert.equal(naechsterSchritt(e, lage({ abend: true })), null);
  assert.equal(naechsterSchritt(e, lage({ wartet: true })), 'anlegen');
});

test('beendet bleibt beendet und liegt im Spielstand', () => {
  const state = {};
  const e = einstiegState(state);
  e.fertig = true;
  assert.equal(naechsterSchritt(e, lage({ wartet: true })), null);
  assert.equal(JSON.parse(JSON.stringify(state)).modules.einstieg.fertig, true);
});
