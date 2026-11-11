// Balancing: Daten in web/js/data/economy.js passen zu harbor.js, und die Spielzeit bleibt im
// Zielkorridor (docs/balancing.md). Aufruf: node --test tests/balance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefen, spiel } from '../tools/balance.mjs';
import { ECONOMY } from '../web/js/data/economy.js';

test('economy.js passt zu harbor.js', () => {
  assert.deepEqual(pruefen(), []);
});

test('keine laufenden Kosten', () => {
  for (const [id, s] of Object.entries(ECONOMY.services)) {
    for (const st of s.stufen) assert.ok(!st.unterhalt, `${id}: unterhalt`);
  }
});

test('Region ist in 180 bis 300 Spieltagen abschließbar', () => {
  for (const profil of ['geschickt', 'gemuetlich']) {
    const tage = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => spiel(seed, profil).ende);
    for (const t of tage) assert.ok(t != null, `${profil}: Region nicht abgeschlossen`);
    const median = [...tage].sort((a, b) => a - b)[4];
    assert.ok(median >= 180 && median <= 300, `${profil}: Median ${median} Tage`);
  }
});

test('gleicher Seed, gleiches Ergebnis', () => {
  assert.deepEqual(spiel(42, 'geschickt'), spiel(42, 'geschickt'));
});
