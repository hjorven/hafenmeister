// Prüft die Spieldaten der Schiffe der Größe L (ohne Three.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MODELS, MODEL_BY_ID, fits } from '../web/js/data/boats/l.js';

test('4 Arten mit je 5 Modellen', () => {
  assert.equal(TYPES.length, 4);
  for (const t of TYPES) assert.equal(MODELS.filter((m) => m.typeId === t.id).length, 5, t.id);
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 20);
});

test('Maße liegen im Bereich der Art und in Größe L', () => {
  for (const m of MODELS) {
    const t = TYPES.find((x) => x.id === m.typeId);
    for (const key of ['length', 'beam', 'draft']) {
      assert.ok(m[key] >= t[key][0] && m[key] <= t[key][1], `${m.id} ${key} ${m[key]}`);
    }
    assert.ok(m.length > 9 && m.length <= 14, m.id);
    assert.ok(m.fromStage >= t.fromStage, m.id);
    assert.ok(m.palettes.length >= 3, m.id);
    for (const p of m.palettes) for (const k of ['hull', 'trim', 'deck', 'canvas', 'house', 'roof']) assert.match(p[k], /^#[0-9a-f]{6}$/, `${m.id} ${k}`);
  }
});

test('Passregel: Kielyacht in Box L, Katamaran nur am Stirnplatz', () => {
  const boxL = { length: 14, beam: 4.5, depth: 3.5, kind: 'boxL' };
  const stirn = { length: 14, beam: 7.5, depth: 3.5, kind: 'stirn' };
  const flach = { length: 14, beam: 4.5, depth: 2.0, kind: 'boxL' };
  assert.equal(fits(MODEL_BY_ID['L1-1'], boxL), true);
  assert.equal(fits(MODEL_BY_ID['L1-1'], flach), false);
  assert.equal(fits(MODEL_BY_ID['L2-1'], boxL), false);
  assert.equal(fits(MODEL_BY_ID['L2-1'], stirn), true);
  for (const m of MODELS) assert.equal(fits(m, m.mooring === 'stirn' ? stirn : boxL), true, m.id);
});
