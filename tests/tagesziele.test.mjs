// Tagesziele (docs/neue-features.md, Abschnitt 6): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { neueZiele, werteAus, zielState, text, VORLAGEN } from '../web/js/features/tagesziele.js';

function neu(seed = 3, stufe = 1) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const state = createState({ seed });
  state.stage = stufe;
  sim.tick(state, ctx, 0);
  return { ctx, state };
}

test('drei verschiedene Ziele, nur aus der eigenen Stufe', () => {
  for (const stufe of [1, 2, 3, 4, 5]) {
    for (let seed = 1; seed < 15; seed++) {
      const { ctx, state } = neu(seed, stufe);
      const l = neueZiele(state, ctx);
      assert.equal(l.length, 3);
      assert.equal(new Set(l.map((z) => z.art)).size, 3);
      for (const z of l) {
        assert.ok(VORLAGEN[z.art].abStufe <= stufe, `${z.art} in Stufe ${stufe}`);
        assert.ok(z.soll >= 1);
        assert.equal(typeof text(z), 'string');
      }
      // Stammgast-Ziel nur, wenn es Stammgäste gibt
      assert.ok(!l.some((z) => z.art === 'stammgast'));
    }
  }
});

test('im Winter keine Ziele', () => {
  const { ctx, state } = neu();
  state.day = ctx.rules.seasonDays + 1;
  assert.deepEqual(neueZiele(state, ctx), []);
});

test('Unterbringen zählt und wird erledigt, Belohnung kommt einmal', () => {
  const { ctx, state } = neu();
  const z = zielState(state);
  z.tag = state.day;
  z.liste = [{ art: 'unterbringen', soll: 2, ist: 0, erledigt: false, belohnung: 10 }];
  state.boats[1] = { id: 1, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  state.boats[2] = { id: 2, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  assert.deepEqual(werteAus(state, ctx, { type: 'moored', boatId: 1 }), []);
  assert.equal(werteAus(state, ctx, { type: 'moored', boatId: 2 }).length, 1);
  assert.equal(z.liste[0].erledigt, true);
  assert.deepEqual(werteAus(state, ctx, { type: 'moored', boatId: 2 }), []);
});

test('Kassieren summiert Beträge, ganz zufrieden braucht alle Wünsche', () => {
  const { ctx, state } = neu();
  const z = zielState(state);
  z.tag = state.day;
  z.liste = [
    { art: 'kassieren', soll: 20, ist: 0, erledigt: false, belohnung: 10 },
    { art: 'zufrieden', soll: 1, ist: 0, erledigt: false, belohnung: 10 },
  ];
  state.boats[5] = { id: 5, typeId: 'S1', size: 'S', wishes: ['wc', 'essen'] };
  werteAus(state, ctx, { type: 'collected', boatId: 5, amount: 12 });
  assert.equal(z.liste[0].ist, 12);
  werteAus(state, ctx, { type: 'feeReady', boatId: 5, wishesMet: ['wc'] });
  assert.equal(z.liste[1].erledigt, false);
  werteAus(state, ctx, { type: 'feeReady', boatId: 5, wishesMet: ['wc', 'essen'] });
  assert.equal(z.liste[1].erledigt, true);
  werteAus(state, ctx, { type: 'collected', boatId: 5, amount: 12 });
  assert.equal(z.liste[0].erledigt, true);
});

test('Ziele vom Vortag zählen nicht mehr', () => {
  const { ctx, state } = neu();
  neueZiele(state, ctx);
  state.day += 1;
  state.boats[1] = { id: 1, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  assert.deepEqual(werteAus(state, ctx, { type: 'moored', boatId: 1 }), []);
});

test('ein ganzer Spieltag mit Hafenbüro schafft Ziele', () => {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const state = createState({ seed: 8 });
  state.office = 3;
  let geschafft = 0;
  for (let d = 0; d < 10; d++) {
    sim.tick(state, ctx, 0);
    neueZiele(state, ctx);
    const events = [];
    while (state.phase === 'day') events.push(...sim.tick(state, ctx, 5));
    events.push(...sim.collectAll(state, ctx, true));
    for (const e of events) geschafft += werteAus(state, ctx, e).length;
    sim.runDay(state, ctx);
  }
  assert.ok(geschafft > 0, 'in 10 Tagen sollte mindestens ein Ziel geschafft werden');
});
