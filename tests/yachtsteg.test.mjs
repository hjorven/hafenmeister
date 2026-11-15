// Yachtsteg in Stufe 6 (P59, D9, docs/stege-umbauen.md): Stegausbau, Plätze, Seebrücke kreuzt ihn nicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { seebrueckeStrecke, yachtstegRechteck } from '../web/js/render/landschaft/strand.js';
import { formSetzen } from '../web/js/render/landschaft/formen.js';

function neu(stage = 6) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 5, rules: ctx.rules }), ctx, stage);
  return { ctx, state };
}

test('Hafendaten: Yachtsteg nur in Stufe 6, zwei XL-Plätze längsseits im tiefen Wasser', () => {
  const y = HAFEN.plaetze.filter((p) => p.steg === 'Y');
  assert.equal(y.length, 2);
  for (const p of y) {
    assert.deepEqual(p.stufen, [6]);
    assert.equal(p.klasse, 'XL');
    assert.ok(p.maxLaenge >= 40 && p.maxBreite >= 8);
    assert.ok(p.tiefe['6'] >= 4, 'Großyachten mit 3,5 m Tiefgang');
  }
  assert.ok(HAFEN.stufen[6].stege.some((l) => l.steg === 'Y'));
  assert.equal(HAFEN.stege.Y, 'Yachtsteg');
});

test('Stegausbau: in Stufe 6 kaufbar, bringt zwei XL-Plätze, Hafenziel zählt ihn', () => {
  const { ctx, state } = neu();
  delete state.buildings.yachtsteg;
  state.money = 1e6;
  assert.ok(sim.openJettyProjects(state, ctx).some((p) => p.id === 'yachtsteg'));
  const offen = sim.regionGoal(state, ctx).openBerths;
  const xl = () => sim.availableBerths(state, ctx).filter((b) => b.size === 'XL').length;
  const vorher = xl();
  assert.ok(sim.buildJettyProject(state, ctx, 'yachtsteg').ok);
  assert.equal(xl(), vorher + 2);
  assert.equal(sim.regionGoal(state, ctx).openBerths, offen - 2);
  const yacht = { id: 'y', typeId: 'XL2', size: 'XL', length: 38, beam: 7.5, draft: 3.5 };
  assert.ok(sim.fits(yacht, ctx.berthById.Y01, ctx.rules, 6));
  const s5 = neu(5);
  assert.ok(!sim.openJettyProjects(s5.state, s5.ctx).some((p) => p.id === 'yachtsteg'));
});

test('Seebrücke kreuzt den Yachtsteg auf keiner Küste', () => {
  const r = yachtstegRechteck();
  assert.ok(r);
  for (const reg of ['ostsee', 'nordsee']) for (let f = 1; f <= 10; f++) for (const seed of [1, 7, 8, 11]) {
    formSetzen(f, seed);
    const s = seebrueckeStrecke(6, reg);
    if (!s) continue;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = s.fuss[0] + (s.kopf[0] - s.fuss[0]) * t, y = s.fuss[1] + (s.kopf[1] - s.fuss[1]) * t;
      assert.ok(x < r.x0 - 10 || x > r.x1 + 10 || y < r.y0 - 10 || y > r.y1 + 10, `${reg} Form ${f} Seed ${seed}: Seebrücke bei (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }
  }
  formSetzen(1, 1);
});
