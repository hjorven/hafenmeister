// Prüft die Spieldaten der Schiffe der Größe S (ohne Three.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MODELS, getModel, modelsForStage, fitsBerth, crewOf } from '../web/js/data/boats/s.js';

test('5 Arten mit je 5 Modellen, ids eindeutig', () => {
  assert.equal(TYPES.length, 5);
  for (const t of TYPES) assert.equal(MODELS.filter((m) => m.typeId === t.id).length, 5, t.id);
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 25);
  for (const m of MODELS) assert.equal(getModel(m.id), m);
});

test('Maße liegen im Bereich der Art und in Größe S', () => {
  for (const m of MODELS) {
    const t = TYPES.find((x) => x.id === m.typeId);
    for (const key of ['length', 'beam', 'draft']) {
      assert.ok(m[key] >= t[key][0] && m[key] <= t[key][1], `${m.id} ${key} ${m[key]}`);
    }
    assert.ok(m.length <= 6, m.id);
    assert.ok(m.fromStage >= t.fromStage, m.id);
    assert.ok(m.airDraft > 0, m.id);
    assert.ok(m.palettes.length >= 3, m.id);
    assert.ok(m.parts.hull && m.parts.deck && Array.isArray(m.parts.extras), m.id);
  }
});

test('Jedes S-Boot passt in eine Box S an Steg A', () => {
  const boxS = { length: 6, beam: 2.4, depth: 1.5 };
  for (const m of MODELS) assert.equal(fitsBerth(m, boxS), true, m.id);
  assert.equal(fitsBerth(getModel('S5-4'), { length: 6, beam: 2.4, depth: 0.7 }), false);
});

test('Für Version 1.0 je Art mindestens zwei Modelle, Stufe 1 nur S1 bis S3', () => {
  for (const t of TYPES) assert.ok(MODELS.filter((m) => m.typeId === t.id && m.priority === 1).length >= 2, t.id);
  const s1 = modelsForStage(1);
  assert.ok(s1.length > 0);
  for (const m of s1) assert.ok(['S1', 'S2', 'S3'].includes(m.typeId), m.id);
});

test('Menschen an Bord: 1 bis 3 (Plan, Abschnitt 11a)', () => {
  for (const t of TYPES) assert.ok(Array.isArray(t.crew), t.id);
  for (const m of MODELS) {
    const [lo, hi] = crewOf(m);
    assert.ok(lo >= 1 && hi <= 3 && lo <= hi, m.id);
  }
});
