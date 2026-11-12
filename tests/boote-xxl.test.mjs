// Tests für die Daten der XXL-Schiffe (web/js/data/boats/xxl.js), ohne Grafik.
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MODELS, BERTHS, fitsBerth } from '../web/js/data/boats/xxl.js';
import { typesFromModule } from '../web/js/bridge.js';
import * as sim from '../web/js/sim.js';
import * as xxl from '../web/js/data/boats/xxl.js';

const within = (v, [a, b]) => v >= a && v <= b;

test('drei Arten mit je drei Modellen, eindeutige ids', () => {
  assert.deepEqual(TYPES.map((t) => t.id), ['XXL1', 'XXL2', 'XXL3']);
  assert.equal(MODELS.length, 9);
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 9);
  for (const t of TYPES) {
    const ms = MODELS.filter((m) => m.typeId === t.id);
    assert.equal(ms.length, 3, t.id);
    ms.forEach((m, i) => assert.equal(m.id, `${t.id}-${i + 1}`));
  }
});

test('Maße, crew und Liegeplatz passen zur Art', () => {
  for (const m of MODELS) {
    const t = TYPES.find((x) => x.id === m.typeId);
    assert.ok(within(m.length, t.length), `${m.id} Länge`);
    assert.ok(within(m.beam, t.beam), `${m.id} Breite`);
    assert.ok(within(m.draft, t.draft), `${m.id} Tiefgang`);
    assert.ok(within(m.crew[0], t.crew) && within(m.crew[1], t.crew), `${m.id} crew`);
    assert.equal(m.fromStage, 6);
    assert.equal(m.mooring, t.mooring);
    assert.ok(fitsBerth(m, BERTHS[m.mooring]), `${m.id} passt an ${m.mooring}`);
    assert.equal(m.palettes.length, 3);
  }
});

test('Menschen an Bord wie im Plan: Kreuzfahrt 80 bis 200, Marine 20 bis 60', () => {
  assert.deepEqual(TYPES[0].crew, [80, 200]);
  assert.deepEqual(TYPES[1].crew, [20, 60]);
});

test('die Spielregeln lesen die Arten: Stufe 6, Freischaltung, Seenotkreuzer nicht stationiert', () => {
  const types = typesFromModule(xxl);
  const ctx = sim.createContext({ boatTypes: types, berths: [] });
  const byId = Object.fromEntries(ctx.types.map((t) => [t.id, t]));
  assert.equal(byId.XXL1.size, 'XXL');
  assert.equal(byId.XXL1.minStage, 6);
  assert.equal(byId.XXL1.unlock, 'kreuzfahrt');
  assert.equal(byId.XXL2.unlock, 'marine');
  assert.ok(!byId.XXL3.stationed, 'Seenotkreuzer kommt über services, nicht als stationiertes Boot der Simulation');
  assert.equal(byId.XXL3.kind, 'seenotretter');
  assert.equal(byId.XXL1.models.length, 3);
  assert.equal(byId.XXL1.models[0].minStage, 6);
});
