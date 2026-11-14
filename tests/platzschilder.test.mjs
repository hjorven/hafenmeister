// Grün-Rot-Schilder an den Gastboxen (features/platzschilder.js): Farbe aus den Regeln.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { farbe } from '../web/js/features/platzschilder.js';
import * as dauer from '../web/js/features/dauerlieger.js';

function neu() {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  dauer.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const state = createState({ seed: 5 });
  state.stage = 2;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  sim.tick(state, ctx, 0);
  return { ctx, state };
}

test('freie Box grün, belegte rot, Kai und Fischer ohne Schild', () => {
  const { ctx, state } = neu();
  const boxen = sim.availableBerths(state, ctx).filter((b) => b.kind === 'box' || b.kind === 'finger');
  assert.ok(boxen.length > 3);
  for (const b of boxen) assert.equal(farbe(state, ctx, b), 'gruen');
  for (const b of ctx.berths.filter((x) => x.kind === 'fischer' || x.kind === 'kai')) assert.equal(farbe(state, ctx, b), null);
  state.boats[999] = { id: 999, status: 'moored', berthId: boxen[0].id, wishes: [] };
  state.berths[boxen[0].id] = 999;
  assert.equal(farbe(state, ctx, boxen[0]), 'rot');
});

test('nicht gekaufte Box hat kein Schild', () => {
  const { ctx, state } = neu();
  const b = ctx.berths.find((x) => x.requires && (x.kind === 'box' || x.kind === 'finger') && x.stages.includes(2));
  assert.ok(b);
  delete state.buildings[b.requires];
  assert.equal(farbe(state, ctx, b), null);
});

test('Dauerplatz: rot, solange das Boot da ist oder nur auf Tagesausflug, grün auf mehrtägigem Törn', () => {
  const { ctx, state } = neu();
  for (let i = 0; i < 4; i++) dauer.neuerBewerber(state, ctx);   // Bewerber mit Booten verschiedener Größe
  const platz = sim.availableBerths(state, ctx).find((b) => b.kind === 'box' && dauer.kannDauerplatz(state, ctx, b.id).ok);
  const r = dauer.machDauerplatz(state, ctx, platz.id);
  assert.ok(r.ok);
  assert.equal(farbe(state, ctx, platz), 'rot');
  const p = dauer.dauerState(state).plaetze[platz.id];
  p.tagestoern = true;
  assert.equal(farbe(state, ctx, platz), 'rot');
  // Mehrtägiger Törn: Boot ist aus dem Hafen
  p.tagestoern = false;
  const boot = state.boats[p.bootId];
  delete state.berths[platz.id]; delete state.boats[boot.id];
  p.boot = boot; p.rueckNacht = state.day + 2;
  assert.equal(farbe(state, ctx, platz), 'gruen');
});

test('Schild steht am Stegende der Box, nicht draußen an den Pfählen', async () => {
  const { kopfDerBox } = await import('../web/js/features/platzschilder.js');
  const stege = HAFEN.stufen['2'].stege;
  const b = HAFEN.plaetze.find((p) => p.id === 'B05');
  const kopf = kopfDerBox(b, stege, 2);
  // Steg B ist die Linie x = -55, die Box liegt mit der Mitte bei x = -63.7 und Richtung Osten
  assert.ok(Math.abs(kopf.x - -55) < 3, `x ${kopf.x}`);
});

test('im Winter kein Schild an den Gastboxen (keine Gäste)', () => {
  const { ctx, state } = neu();
  const box = sim.availableBerths(state, ctx).find((b) => b.kind === 'box' || b.kind === 'finger');
  assert.equal(farbe(state, ctx, box), 'gruen');
  state.day = ctx.rules.seasonDays + 1;
  assert.equal(sim.season(state, ctx).winter, true);
  assert.equal(farbe(state, ctx, box), null);
  state.day = ctx.rules.seasonDays + ctx.rules.winterDays + 1;
  assert.equal(farbe(state, ctx, box), 'gruen');
});
