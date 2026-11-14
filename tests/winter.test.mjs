// Winter mit Inhalt (features/winter.js, docs/winter.md): Angebote, Aufträge, Wirkung, Bilanz.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { angebote, beauftrage, aktiveAuftraege, modifikator, ankerBonus, aufraeumen, saisonBilanz, haengeEin, gastStege, ARBEITEN } from '../web/js/features/winter.js';

const CTX = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
const LEN = CTX.rules.seasonDays + CTX.rules.winterDays;

function neu({ stage = 1, day = CTX.rules.seasonDays + 1, money = 10000, wc = 1 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 3, rules: ctx.rules }), ctx, stage);
  state.day = day;
  state.money = money;
  state.facilities = { ...(state.facilities || {}), wc };
  return { ctx, state };
}

test('Im Winter liegen zwei bis drei Aufträge, im Sommer kein Auftrag möglich', () => {
  const { ctx, state } = neu();
  const a = angebote(state, ctx);
  assert.ok(a.length >= 2 && a.length <= 3, JSON.stringify(a));
  assert.deepEqual(a.map((x) => x.id), ['steg', 'werbung', 'sanitaer']);
  for (const x of a) assert.equal(x.fuer, 2);
  state.day = 5;
  assert.equal(beauftrage(state, ctx, 'werbung').grund, 'sommer');
});

test('Ohne Toilette in Stufe 1: nur Steg und Werbung; ab Stufe 3 wechseln Sanitär und Baggern', () => {
  assert.deepEqual(angebote(neu({ wc: 0 }).state, CTX).map((x) => x.id), ['steg', 'werbung']);
  const j1 = neu({ stage: 3 });
  assert.equal(angebote(j1.state, j1.ctx)[2].id, 'sanitaer');
  const j2 = neu({ stage: 3, day: LEN + CTX.rules.seasonDays + 1 });
  assert.equal(angebote(j2.state, j2.ctx)[2].id, 'baggern');
  assert.equal(angebote(j2.state, j2.ctx)[2].kosten, ARBEITEN.baggern.kosten[2]);
});

test('Auftrag kostet Geld, zählt als Ausgabe, geht nur einmal', () => {
  const { ctx, state } = neu({ money: 100 });
  const r = beauftrage(state, ctx, 'steg');
  assert.ok(r.ok);
  assert.equal(state.money, 100 - ARBEITEN.steg.kosten[0]);
  assert.equal(beauftrage(state, ctx, 'steg').grund, 'schon');
  assert.equal(beauftrage(state, ctx, 'werbung').grund, 'geld');
  assert.equal(state.money, 100 - ARBEITEN.steg.kosten[0]);
});

test('Wirkung erst in der nächsten Saison: Werbung im Frühling, Steg und Sanitär auf die Bewertung', () => {
  const { ctx, state } = neu();
  for (const id of ['steg', 'werbung', 'sanitaer']) assert.ok(beauftrage(state, ctx, id).ok, id);
  const steg = state.modules.winter.auftraege.find((a) => a.id === 'steg').steg;
  // Noch Winter: nichts
  assert.equal(modifikator(state, ctx), null);
  assert.equal(aktiveAuftraege(state, ctx).length, 0);
  // Frühling Jahr 2
  state.day = LEN + 1;
  assert.equal(modifikator(state, ctx).arrivalFactor, ARBEITEN.werbung.faktor);
  const platz = ctx.berths.find((b) => b.jetty === steg && !b.reserved);
  const andererPlatz = ctx.berths.find((b) => b.jetty !== steg && !b.reserved);
  assert.equal(ankerBonus(state, ctx, { berthId: platz.id, wishes: [] }), ARBEITEN.steg.bonus);
  assert.equal(ankerBonus(state, ctx, { berthId: andererPlatz.id, wishes: ['wc'] }), ARBEITEN.sanitaer.bonus);
  assert.equal(ankerBonus(state, ctx, { berthId: andererPlatz.id, wishes: ['strom'] }), 0);
  // Sommer: Werbung vorbei
  state.day = LEN + ARBEITEN.werbung.bisTag + 1;
  assert.equal(modifikator(state, ctx), null);
  // Saison danach: alles vorbei, Frühling räumt auf
  state.day = 2 * LEN + 1;
  assert.equal(ankerBonus(state, ctx, { berthId: platz.id, wishes: ['wc'] }), 0);
  aufraeumen(state, ctx);
  assert.equal(state.modules.winter.auftraege.length, 0);
});

test('Hook in den Regeln: Bewertung steigt am überholten Steg', () => {
  const { ctx, state } = neu();
  assert.ok(beauftrage(state, ctx, 'steg').ok);
  const steg = state.modules.winter.auftraege[0].steg;
  const platz = ctx.berths.find((b) => b.jetty === steg && !b.reserved);
  state.day = LEN + 5;
  const boot = { berthId: platz.id, wishes: [], wishesMet: 0, wishesTotal: 0 };
  const ohne = sim.ratingParts(ctx, boot).comfort;
  const ab = haengeEin((name, fn) => sim.addHook(ctx, name, fn), () => state);
  assert.equal(Math.round((sim.ratingParts(ctx, boot).comfort - ohne) * 100) / 100, ARBEITEN.steg.bonus);
  ab();
  assert.equal(sim.ratingParts(ctx, boot).comfort, ohne);
});

test('Baggern: mehr große Boote über sizeFactor', () => {
  const { ctx, state } = neu({ stage: 3, day: LEN + CTX.rules.seasonDays + 1 });
  assert.ok(beauftrage(state, ctx, 'baggern').ok);
  state.day = 2 * LEN + 12;
  const m = modifikator(state, ctx);
  for (const k of ARBEITEN.baggern.klassen) assert.equal(m.sizeFactor[k], ARBEITEN.baggern.faktor);
});

test('Steg wechselt von Jahr zu Jahr zwischen den zwei größten', () => {
  const { ctx, state } = neu({ stage: 4 });
  const stege = gastStege(state, ctx);
  assert.ok(stege.length >= 2);
  const s1 = angebote(state, ctx)[0].steg;
  state.day += LEN;
  const s2 = angebote(state, ctx)[0].steg;
  assert.deepEqual([s1, s2].sort(), [stege[0].id, stege[1].id].sort());
});

test('Saisonbilanz aus dem Verlauf', () => {
  const { ctx, state } = neu();
  state.stats.verlauf = Array.from({ length: 30 }, (_, i) => ({ tag: i + 1, summe: 10 * (i + 1), ausgabenSumme: i === 3 ? 80 : 0, angelegt: 2, abgereist: 2, bewertung: 4, weggefahrenSumme: i % 10 === 0 ? 1 : 0, ruf: { vorher: 3, nachher: 3.4 } }));
  const b = saisonBilanz(state, ctx);
  assert.equal(b.jahr, 1);
  assert.equal(b.tage, 30);
  assert.equal(b.einnahmen, 10 * 465);
  assert.equal(b.ausgaben, 80);
  assert.equal(b.angelegt, 60);
  assert.equal(b.bewertung, 4);
  assert.equal(b.weggefahren, 3);
  assert.deepEqual(b.ruf, { vorher: 3, nachher: 3.4 });
  assert.deepEqual(b.besterTag, { tag: 30, summe: 300 });
});
