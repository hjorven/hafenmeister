import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, random, randomInt, serialize, deserialize, SAVE_VERSION,
} from '../web/js/state.js';
import * as stateModul from '../web/js/state.js';

test('neuer Spielstand: Startwerte', () => {
  const s = createState({ seed: 42 });
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.day, 1);
  assert.equal(s.stage, 1);
  assert.equal(s.money, 0);
  assert.equal(s.phase, 'day');
  assert.deepEqual(s.ratings, [3, 3, 3, 3, 3]);
  assert.equal(s.facilities.wc, 0);
});

test('Zufall ist bei gleichem Seed gleich und liegt in [0, 1)', () => {
  const a = createState({ seed: 7 });
  const b = createState({ seed: 7 });
  const xs = Array.from({ length: 1000 }, () => random(a));
  const ys = Array.from({ length: 1000 }, () => random(b));
  assert.deepEqual(xs, ys);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const c = createState({ seed: 8 });
  assert.notEqual(random(c), xs[0]);
});

test('randomInt deckt beide Grenzen ab', () => {
  const s = createState({ seed: 1 });
  const seen = new Set(Array.from({ length: 500 }, () => randomInt(s, 1, 3)));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('Speichern und Laden ergibt denselben Spielstand', () => {
  const s = createState({ seed: 3 });
  s.money = 1234;
  s.buildings['steg-a-knick'] = 1;
  const copy = deserialize(serialize(s));
  assert.deepEqual(copy, s);
});

test('kaputte Spielstände werden abgelehnt', () => {
  assert.throws(() => deserialize('kein json'), /kein gültiges JSON/);
  assert.throws(() => deserialize('{}'), /keine Version/);
  assert.throws(() => deserialize(JSON.stringify({ version: SAVE_VERSION + 1 })), /neueren/);
  const s = createState({ seed: 1 });
  delete s.money;
  assert.throws(() => deserialize(JSON.stringify(s)), /money fehlt/);
  const t = createState({ seed: 1 });
  t.queue = 'x';
  assert.throws(() => deserialize(JSON.stringify(t)), /falschen Typ|Listen/);
});

test('ein Speicherweg: state.js speichert nicht mehr selbst', () => {
  // Speichern, Plätze, Export und Import liegen nur noch in web/js/save/ (docs/speichern.md)
  for (const name of ['save', 'load', 'clearSave', 'exportSave', 'importSave', 'SAVE_KEY']) {
    assert.equal(name in stateModul, false, `${name} gehört nach web/js/save/`);
  }
});

test('neuer Spielstand hat einen Hafennamen (leer) und alte Stände bekommen ihn beim Laden', () => {
  const s = createState({ seed: 4 });
  assert.equal(s.harborName, '');
  const alt = createState({ seed: 4 });
  delete alt.harborName;
  assert.equal(deserialize(JSON.stringify(alt)).harborName, '');
});

test('Laden prüft verschachtelte Daten: falsche Typen und Extremwerte werden abgelehnt', () => {
  const kaputt = (aendern) => { const s = createState({ seed: 2 }); aendern(s); return JSON.stringify(s); };
  assert.throws(() => deserialize(kaputt((s) => { s.boats = null; })), /boats/);
  assert.throws(() => deserialize(kaputt((s) => { s.day = 1e9; })), /Tag/);
  assert.throws(() => deserialize(kaputt((s) => { s.stage = 0; })), /Stufe/);
  assert.throws(() => deserialize(kaputt((s) => { s.money = 1e300; })), /Geld/);
  assert.throws(() => deserialize(kaputt((s) => { s.ratings = [3, 99]; })), /Bewertungen/);
  assert.throws(() => deserialize(kaputt((s) => { s.boats = { 7: { id: 8, status: 'moored' } }; })), /Boot 7/);
  assert.throws(() => deserialize(kaputt((s) => { s.boats = { 7: { id: 7, status: 'moored', draft: -3 } }; })), /draft/);
});

test('Laden repariert lose Verweise und begrenzt den Hafennamen', () => {
  const s = createState({ seed: 2 });
  s.boats = { 5: { id: 5, status: 'moored', berthId: 'A03' } };
  s.berths = { A03: 5, A04: 77 };
  s.queue = [5, 99];
  s.nextId = 2;
  s.harborName = '<b>Hafen</b>' + 'x'.repeat(100);
  const d = deserialize(JSON.stringify(s));
  assert.deepEqual(d.berths, { A03: 5 });
  assert.deepEqual(d.queue, [5]);
  assert.equal(d.nextId, 6);
  assert.equal(d.harborName.includes('<'), false);
  assert.ok(d.harborName.length <= 32);
});
