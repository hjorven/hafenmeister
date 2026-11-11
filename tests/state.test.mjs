import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, random, randomInt, serialize, deserialize, save, load, clearSave,
  exportSave, importSave, SAVE_KEY, SAVE_VERSION,
} from '../web/js/state.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}

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

test('save und load mit Speicher, auch ohne Speicher', () => {
  const st = memoryStorage();
  const s = createState({ seed: 9 });
  assert.equal(save(s, st), true);
  assert.ok(st._map.has(SAVE_KEY));
  assert.deepEqual(load(st), s);
  st.setItem(SAVE_KEY, '{kaputt');
  assert.equal(load(st), null);
  clearSave(st);
  assert.equal(load(st), null);
  assert.equal(save(s, null), false);
  assert.equal(load(null), null);
  const full = { setItem() { throw new Error('voll'); }, getItem() { return null; } };
  assert.equal(save(s, full), false);
});

test('Export und Import, auch mit Umlauten', () => {
  const s = createState({ seed: 11 });
  s.harborName = 'Hafen Großenbrode Süd';
  const code = exportSave(s);
  assert.match(code, /^HM1:[A-Za-z0-9+/=]+$/);
  assert.deepEqual(importSave(code), s);
  assert.deepEqual(importSave(`  ${code}\n`), s);
  assert.throws(() => importSave('hallo'), /kein Hafenmeister-Spielstand/);
  assert.throws(() => importSave('HM1:%%%'), /beschädigt/);
});
