// Liegende Boote liegen frei: kein Rumpf schneidet Steg, Pfahl, Kaimauer, Seebrücke, Land oder ein
// anderes Boot (data/liegelage.js, Werkzeug tools/liegeplaetze/pruefen.mjs). Gerechnet mit dem größten
// Boot, das die Spielregeln an den Platz lassen, in jedem Stegbild und jeder Küstenform.
// Ausführen im Repo-Ordner:  node --test tests/liegeplaetze.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAFEN } from '../web/js/data/harbor.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { punkt } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { FORMEN, formSetzen } from '../web/js/render/landschaft/formen.js';
import { seebrueckeStrecke } from '../web/js/render/landschaft/strand.js';
import { liegeGeometrie, liegeVersatz, liegeRumpf, nachbarFrei, stegTeile, schneiden, U, LUFT_M } from '../web/js/data/liegelage.js';
import { pruefeLiegeplaetze, brueckenFlaeche } from '../tools/liegeplaetze/pruefen.mjs';

const ostsee = region('ostsee');
const kopie = () => JSON.parse(JSON.stringify(HAFEN));

function alleFunde(h, form, seed) {
  const out = [];
  for (let stufe = 1; stufe <= 6; stufe++) {
    const land = (x, y) => punkt(x, y, stufe, ostsee).h >= 0;
    for (const e of pruefeLiegeplaetze(h, stufe, { land, bruecke: brueckenFlaeche(seebrueckeStrecke(stufe)) })) out.push(`Form ${form} Seed ${seed}: ${e.text}`);
  }
  return out;
}

test('Jedes Stegbild: liegende Boote schneiden nichts (Küstenform 1)', () => {
  const fehler = [];
  try {
    formSetzen(1, 1);
    for (let nr = 0; nr <= STEGBILDER.varianten.length; nr++) fehler.push(...alleFunde(stegbildSetzen(kopie(), nr), 1, 1).map((t) => `Stegbild ${nr}, ${t}`));
  } finally { formSetzen(1); }
  assert.deepEqual(fehler, []);
});

test('Jede Küstenform mit mehreren Seeds: liegende Boote liegen nicht an Land oder unter der Seebrücke', () => {
  const fehler = [];
  try {
    for (const { nr } of FORMEN) {
      for (const seed of [1, 13 * nr + 1, 4242]) {
        formSetzen(nr, seed);
        fehler.push(...alleFunde(stegbildSetzen(kopie(), nr % (STEGBILDER.varianten.length + 1)), nr, seed));
      }
    }
  } finally { formSetzen(1); }
  assert.deepEqual(fehler, []);
});

test('Box: Bug bleibt 0,3 m vor dem Steg, ein längeres Boot ragt achtern hinaus', () => {
  const geo = liegeGeometrie(HAFEN, 4);
  const g = geo.get('C22');
  for (const L of [8, 12.4, 14]) {
    const v = liegeVersatz(g, L, 4);
    const bug = v.a + L / U / 2;
    assert.ok(Math.abs(bug - (g.laenge / 2 - LUFT_M / U)) < 1e-9, `Bug bei ${L} m`);
  }
  // Ein 14 m langes, 4,5 m breites Boot an C22 schneidet keinen Steg (Härtetest 15.11.: ragte auf den Stegkopf)
  const r = liegeRumpf(g, 14, 4.5);
  assert.deepEqual(stegTeile(HAFEN, 4).filter((t) => t.platz !== 'C22' && schneiden(r, t.poly)).map((t) => t.name), []);
});

test('Längsseits: Bordwand am Steg, breite Boote liegen weiter draußen, beide Stirnplätze tragen je 14 m', () => {
  const geo = liegeGeometrie(HAFEN, 4);
  for (const id of ['B27', 'B28', 'C23', 'C24']) {
    const g = geo.get(id);
    const schmal = liegeVersatz(g, 10, 3), breit = liegeVersatz(g, 13, 7.5);
    // Bordwand auf der Stegseite liegt für beide gleich weit von der Platzmitte
    assert.ok(Math.abs((schmal.q * g.seite + 3 / U / 2) - (breit.q * g.seite + 7.5 / U / 2)) < 1e-9, id);
    assert.ok(breit.q * g.seite < schmal.q * g.seite, `${id}: Katamaran liegt weiter draußen`);
    assert.ok(liegeVersatz(g, 14, 4.5).eigen, `${id}: 14 m passt in den eigenen Abschnitt`);
  }
  // B27 und B28 am selben Stegkopf, beide mit 14 m: kein Überlappen
  assert.equal(schneiden(liegeRumpf(geo.get('B27'), 14, 7.5), liegeRumpf(geo.get('B28'), 14, 7.5)), false);
});

test('Kai: ein langes Schiff nimmt Platz vom Nachbarn nur, wenn dort nichts im Weg liegt', () => {
  const geo = liegeGeometrie(HAFEN, 5);
  // K01 ist für etwa 22 m gezeichnet: 38 m passt nur mit Platz von K02
  assert.equal(liegeVersatz(geo.get('K01'), 38, 7.6).eigen, false);
  assert.equal(nachbarFrei(geo, 'K01', { length: 38, beam: 7.6 }, new Map()), true);
  assert.equal(nachbarFrei(geo, 'K01', { length: 38, beam: 7.6 }, new Map([['K02', { length: 30, beam: 7 }]])), false);
  assert.equal(nachbarFrei(geo, 'K01', { length: 22, beam: 7.6 }, new Map([['K02', { length: 36, beam: 7 }]])), true);
  assert.equal(nachbarFrei(geo, 'K03', { length: 28, beam: 7 }, new Map([['K02', { length: 36, beam: 7 }]])), true);
  // Was nachbarFrei erlaubt, überlappt nie (alle Längen in 1-m-Schritten)
  for (const [a, b] of [['K01', 'K02'], ['K02', 'K03'], ['K01', 'K03']]) {
    for (let la = 20; la <= 40; la += 1) for (let lb = 20; lb <= 40; lb += 1) {
      if (!nachbarFrei(geo, a, { length: la, beam: 8 }, new Map([[b, { length: lb, beam: 8 }]]))) continue;
      assert.equal(schneiden(liegeRumpf(geo.get(a), la, 8), liegeRumpf(geo.get(b), lb, 8)), false, `${a} ${la} m, ${b} ${lb} m`);
    }
  }
});

test('Spielregeln: zweites langes Schiff am Kai passt nicht neben das erste (Grund nachbar)', () => {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = createState({ seed: 3 });
  state.stage = 5;
  const boot = (id, length) => ({ id, size: 'XL', length, beam: 7.6, draft: 2.5, status: 'moored', nights: 1, wishes: [] });
  state.boats.a = { ...boot('a', 38), berthId: 'K01' };
  state.berths.K01 = 'a';
  const zweites = boot('b', 30);
  assert.equal(sim.whyNotFit(zweites, ctx.berthById.K02, ctx.rules, 5), null);
  assert.equal(sim.hookWhyNotFit(state, ctx, zweites, ctx.berthById.K02), 'nachbar');
  assert.equal(sim.hookWhyNotFit(state, ctx, zweites, ctx.berthById.K03), null);
  assert.equal(sim.hookWhyNotFit(state, ctx, boot('c', 24), ctx.berthById.K03), null);
});

test('Spielregeln: Höchstlänge je Stufe, wo ein Steg im Weg wäre (maxLengthAt)', () => {
  const berth = { id: 'X', maxLength: 14, maxBeam: 4.5, depth: { 4: 3 }, maxLengthAt: { 4: 11 } };
  const boot = { length: 12, beam: 4, draft: 1.5 };
  assert.equal(sim.whyNotFit(boot, berth, sim.rulesFromEconomy(ECONOMY), 4), 'length');
  assert.equal(sim.whyNotFit({ ...boot, length: 11 }, berth, sim.rulesFromEconomy(ECONOMY), 4), null);
});
