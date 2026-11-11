// Tests für die Daten der XL-Schiffe (web/js/data/boats/xl.js), ohne Grafik.
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MODELS, BERTHS, KEEL_CLEARANCE, getModel, fitsBerth } from '../web/js/data/boats/xl.js';
import { plaetzeInStufe } from '../web/js/data/harbor.js';

const within = (v, [a, b]) => v >= a && v <= b;

test('drei Arten mit je fünf Modellen, eindeutige ids', () => {
  assert.equal(TYPES.length, 3);
  assert.equal(MODELS.length, 15);
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 15);
  for (const t of TYPES) {
    const ms = MODELS.filter((m) => m.typeId === t.id);
    assert.equal(ms.length, 5, t.id);
    ms.forEach((m, i) => assert.equal(m.id, `${t.id}-${i + 1}`));
  }
});

test('Maße liegen im Bereich der Art und Pflichtfelder sind gesetzt', () => {
  for (const m of MODELS) {
    const t = TYPES.find((x) => x.id === m.typeId);
    assert.ok(within(m.length, t.length), `${m.id} Länge`);
    assert.ok(within(m.beam, t.beam), `${m.id} Breite`);
    assert.ok(within(m.draft, t.draft), `${m.id} Tiefgang`);
    assert.ok(within(m.crew[0], t.crew) && within(m.crew[1], t.crew) && m.crew[0] <= m.crew[1], `${m.id} crew`);
    assert.ok(m.airDraft > 5, `${m.id} airDraft`);
    assert.equal(m.fromStage, 5);
    assert.equal(m.mooring, 'kai');
    assert.ok(['sail', 'motor'].includes(m.propulsion), `${m.id} Antrieb`);
    assert.equal(m.palettes.length, 3, `${m.id} Paletten`);
    for (const p of m.palettes) for (const k of ['hull', 'boot', 'deck', 'house', 'sail', 'spar']) assert.equal(typeof p[k], 'number', `${m.id} ${k}`);
  }
});

test('Menschen an Bord passen zum Plan (XL 6 bis 40)', () => {
  for (const t of TYPES) assert.ok(t.crew[0] >= 6 && t.crew[1] <= 40, t.id);
});

test('jedes Modell passt an den Kai, auch an jeden Kai-Platz aus harbor.js', () => {
  for (const m of MODELS) assert.ok(fitsBerth(m, BERTHS.kai), m.id);
  const kai = plaetzeInStufe(5).filter((p) => p.art === 'kai');
  assert.ok(kai.length >= 1);
  for (const p of kai) {
    const berth = { length: p.maxLaenge, beam: p.maxBreite, depth: p.tiefe['5'] };
    for (const m of MODELS) assert.ok(fitsBerth(m, berth), `${m.id} an ${p.id}`);
  }
});

test('Passregel: Tiefgang plus Sicherheitsabstand', () => {
  const m = getModel('XL2-2');
  assert.equal(fitsBerth(m, { length: 40, beam: 8, depth: m.draft + KEEL_CLEARANCE }), true);
  assert.equal(fitsBerth(m, { length: 40, beam: 8, depth: m.draft + KEEL_CLEARANCE - 0.01 }), false);
  assert.equal(getModel('gibt-es-nicht'), null);
});
