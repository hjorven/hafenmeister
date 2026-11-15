// Chronik: Ist ein Tag voll, verdrängt ein wichtiger Eintrag (Regatta-Ergebnis) den unwichtigsten (P86).
import test from 'node:test';
import assert from 'node:assert/strict';
import { merken, offeneMerk, LOGBUCH } from '../web/js/ui/logbuch-daten.js';

test('voller Tag: Text verdrängt ein neues Modell, Unwichtigeres kommt nicht mehr hinein', () => {
  const state = { day: 3, modules: {} };
  for (let i = 0; i < LOGBUCH.maxMerk; i++) assert.ok(merken(state, { a: 'neu', typ: 'Typ', name: `Modell ${i}` }));
  assert.equal(offeneMerk(state).length, LOGBUCH.maxMerk);
  assert.ok(merken(state, { a: 'text', text: 'Regatta mit 4 Booten: die Yacht gewinnt' }));
  const liste = offeneMerk(state);
  assert.equal(liste.length, LOGBUCH.maxMerk);
  assert.ok(liste.some((m) => m.a === 'text'));
  assert.equal(merken(state, { a: 'ziel' }), false);
});
