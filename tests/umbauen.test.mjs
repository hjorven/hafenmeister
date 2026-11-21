// Stege umbauen (features/umbauen.js, data/doppelboxen.js, docs/stege-umbauen.md): Doppelboxen.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { nebeneinander } from '../web/js/data/doppelboxen.js';
import { angebote, bauen, paare, neuePassende, REGELN } from '../web/js/features/umbauen.js';

function neu({ stage = 4, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 5, rules: ctx.rules }), ctx, stage);
  state.money = money;
  return { ctx, state };
}
const kat = (ctx) => ({ id: 'kat', typeId: 'L2', size: 'L', length: 12, beam: 7.2, draft: 1.2, stationed: false });

test('Hafendaten: Doppelboxen nur aus L-Boxen, die Seite an Seite liegen, jede Box höchstens einmal', () => {
  const d = HAFEN.plaetze.filter((p) => p.doppel);
  assert.ok(d.length >= 4, `nur ${d.length}`);
  const gesehen = new Set();
  for (const p of d) {
    const [a, b] = p.doppel.map((id) => HAFEN.plaetze.find((q) => q.id === id));
    assert.equal(a.klasse, 'L'); assert.equal(a.art, 'box'); assert.equal(a.steg, b.steg);
    for (const s of p.stufen) assert.ok(nebeneinander(a, b, String(s)), `${p.id} Stufe ${s}`);
    for (const id of p.doppel) { assert.ok(!gesehen.has(id), `${id} doppelt`); gesehen.add(id); }
    assert.ok(a.ohne.includes(p.requires) && b.ohne.includes(p.requires));
    assert.ok(p.maxBreite >= 7.5, 'Katamaran passt');
  }
});

test('Jedes Stegbild bekommt eigene Doppelboxen aus seinen Boxen', () => {
  const grund = structuredClone(HAFEN);
  for (let nr = 1; nr <= STEGBILDER.varianten.length; nr++) {
    const h = stegbildSetzen(structuredClone(grund), nr);
    const d = h.plaetze.filter((p) => p.doppel);
    for (const p of d) {
      const [a, b] = p.doppel.map((id) => h.plaetze.find((q) => q.id === id));
      for (const s of p.stufen) assert.ok(nebeneinander(a, b, String(s)), `Stegbild ${nr} ${p.id} Stufe ${s}`);
    }
    // Keine Reste aus dem Grundbild
    const keys = new Set(d.map((p) => p.requires));
    for (const p of h.plaetze) for (const k of p.ohne ?? []) assert.ok(keys.has(k), `Stegbild ${nr}: ${p.id} verweist auf ${k}`);
  }
});

test('Ohne Umbau: Einzelboxen da, Doppelbox nicht; Katamaran passt in keine Box', () => {
  const { ctx, state } = neu();
  const p = paare(state, ctx)[0];
  assert.ok(p && !p.gebaut);
  assert.ok(p.teile.every((t) => sim.berthAvailable(state, t)));
  assert.equal(sim.berthAvailable(state, p.platz), false);
  assert.ok(p.teile.every((t) => !sim.fits(kat(ctx), t, ctx.rules, state.stage)));
  assert.ok(sim.fits(kat(ctx), p.platz, ctx.rules, state.stage));
  assert.ok(neuePassende(state, ctx, p.platz).some((t) => t.id === 'L2'));
});

test('Umbau: kostet Geld, Einzelboxen weg, Doppelbox da; Rückbau macht es rückgängig', () => {
  const { ctx, state } = neu({ money: 3000 });
  const vorher = sim.availableBerths(state, ctx).length;
  const a = angebote(state, ctx).find((x) => x.art === 'umbau');
  assert.ok(a && !a.gesperrt, JSON.stringify(a));
  const r = bauen(state, ctx, 'umbau', a.steg);
  assert.ok(r.ok);
  assert.equal(state.money, 3000 - REGELN.kosten);
  assert.equal(sim.availableBerths(state, ctx).length, vorher - 1);
  assert.ok(sim.berthAvailable(state, ctx.berthById[a.platz]));
  for (const id of a.teile) assert.equal(sim.berthAvailable(state, ctx.berthById[id]), false);
  assert.equal(sim.berthState(state, ctx, a.platz), 'frei');
  // Eine freie Doppelbox reicht: kein weiterer Umbau im Menü, solange sie frei ist (Zusammenspiel K5)
  assert.ok(!angebote(state, ctx).some((x) => x.art === 'umbau' && x.steg === a.steg));
  // Rückbau erst, wenn die schmalen Boxen des Stegs alle belegt sind
  assert.ok(!angebote(state, ctx).some((x) => x.art === 'rueckbau'));
  for (const b of ctx.berths) {
    if (b.jetty === a.steg && b.kind === 'box' && !b.doppel && sim.berthAvailable(state, b)) state.berths[b.id] = 'voll';
  }
  state.boats.voll = { id: 'voll', status: 'moored' };
  const rb = angebote(state, ctx).find((x) => x.art === 'rueckbau' && x.steg === a.steg);
  assert.equal(rb.platz, a.platz);
  assert.ok(bauen(state, ctx, 'rueckbau', a.steg).ok);
  assert.equal(sim.availableBerths(state, ctx).length, vorher);
  assert.equal(state.money, 3000 - REGELN.kosten - REGELN.rueckbau);
});

test('Belegte Boxen werden nicht umgebaut, ein anderes freies Paar schon', () => {
  const { ctx, state } = neu();
  const a = angebote(state, ctx).find((x) => x.art === 'umbau');
  const p = paare(state, ctx).filter((x) => x.platz.jetty === a.steg);
  // alle Paare dieses Stegs bis auf eines belegen
  for (const x of p.slice(1)) state.berths[x.teile[0].id] = 'belegt';
  state.boats.belegt = { id: 'belegt', status: 'moored' };
  const b = angebote(state, ctx).find((x) => x.art === 'umbau' && x.steg === a.steg);
  assert.equal(b.platz, p[0].platz.id);
  state.berths[p[0].teile[1].id] = 'belegt';
  const c = angebote(state, ctx).find((x) => x.art === 'umbau' && x.steg === a.steg);
  assert.equal(c.gesperrt, 'alle Boxen belegt');
  assert.equal(bauen(state, ctx, 'umbau', a.steg).grund, 'belegt');
});

test('Dauerplatz, dessen Boot auf Törn ist, wird nicht umgebaut (Boot käme an eine Box zurück, die es nicht mehr gibt)', () => {
  const { ctx, state } = neu();
  const a = angebote(state, ctx).find((x) => x.art === 'umbau');
  const p = paare(state, ctx).filter((x) => x.platz.jetty === a.steg);
  // Der Dauerlieger der ersten Wahl ist auf Törn: Box leer, für Gäste kurz frei, aber fest gepachtet
  const boot = { id: 'dl', stationed: true, dauer: true, status: 'away' };
  state.modules = { dauer: { plaetze: { [a.teile[0]]: { bootId: 'dl', boot, rueckNacht: state.day + 2 } } } };
  assert.equal(sim.berthState(state, ctx, a.teile[0]), 'frei');
  const b = angebote(state, ctx).find((x) => x.art === 'umbau' && x.steg === a.steg);
  assert.notEqual(b.platz, a.platz, 'ein anderes Paar wird angeboten');
  assert.ok(!b.teile.includes(a.teile[0]));
  // Kein anderes Paar frei: gesperrt statt Umbau der gepachteten Box
  for (const x of p) if (x.platz.id !== a.platz) state.berths[x.teile[0].id] = 'belegt';
  state.boats.belegt = { id: 'belegt', status: 'moored' };
  const c = angebote(state, ctx).find((x) => x.art === 'umbau' && x.steg === a.steg);
  assert.equal(c.gesperrt, 'alle Boxen belegt');
  assert.equal(bauen(state, ctx, 'umbau', a.steg).grund, 'belegt');
  assert.ok(sim.berthAvailable(state, ctx.berthById[a.teile[0]]), 'die gepachtete Box gibt es noch');
});

test('Doppelbox als Dauerplatz wird nicht zurückgebaut, auch wenn ihr Boot auf Törn ist', () => {
  const { ctx, state } = neu();
  const a = angebote(state, ctx).find((x) => x.art === 'umbau');
  assert.ok(bauen(state, ctx, 'umbau', a.steg).ok);
  for (const b of ctx.berths) {
    if (b.jetty === a.steg && b.kind === 'box' && !b.doppel && sim.berthAvailable(state, b)) state.berths[b.id] = 'voll';
  }
  state.boats.voll = { id: 'voll', status: 'moored' };
  assert.ok(angebote(state, ctx).some((x) => x.art === 'rueckbau' && x.steg === a.steg));
  state.modules = { dauer: { plaetze: { [a.platz]: { bootId: 'dl', boot: { id: 'dl', stationed: true }, rueckNacht: state.day + 2 } } } };
  assert.ok(!angebote(state, ctx).some((x) => x.art === 'rueckbau' && x.steg === a.steg));
  assert.equal(bauen(state, ctx, 'rueckbau', a.steg).grund, 'unbekannt');
});

test('Belegte Doppelbox wird nicht zurückgebaut, dafür steht der nächste Umbau wieder im Menü', () => {
  const { ctx, state } = neu();
  const a = angebote(state, ctx).find((x) => x.art === 'umbau');
  assert.ok(bauen(state, ctx, 'umbau', a.steg).ok);
  state.berths[a.platz] = 'kat';
  state.boats.kat = { ...kat(ctx), status: 'moored', berthId: a.platz };
  assert.ok(!angebote(state, ctx).some((x) => x.art === 'rueckbau'), 'kein Rückbau-Eintrag für eine belegte Doppelbox');
  assert.equal(bauen(state, ctx, 'rueckbau', a.steg).grund, 'unbekannt');
  // Die einzige Doppelbox ist belegt: ein weiterer Umbau steht wieder im Menü
  assert.ok(angebote(state, ctx).some((x) => x.art === 'umbau' && x.steg === a.steg && !x.gesperrt));
});

test('Stufe 3: Umbau sichtbar, aber gesperrt bis Stufe 4; Stufe 2: gar nicht', () => {
  const s3 = neu({ stage: 3 });
  const a = angebote(s3.state, s3.ctx);
  assert.ok(a.length && a.every((x) => x.gesperrt === `ab Ausbaustufe ${REGELN.abStufe}`));
  const s2 = neu({ stage: 2 });
  assert.equal(angebote(s2.state, s2.ctx).length, 0);
});

test('Regionsziel zählt Doppelboxen und umgebaute Boxen nicht als fehlende Plätze', () => {
  const { ctx, state } = neu({ stage: 6 });
  const vorher = sim.regionGoal(state, ctx).openBerths;
  const a = angebote(state, ctx).find((x) => x.art === 'umbau' && !x.gesperrt);
  assert.ok(bauen(state, ctx, 'umbau', a.steg).ok);
  assert.equal(sim.regionGoal(state, ctx).openBerths, vorher);
});
