// Kassieren verständlich (Roadmap P12): Vorauszahlung aller Nächte, Rundgang und Nacht mit
// vier Fünfteln, Trinkgeld für den langen Kassierstrich. Geprüft mit den echten Zahlen aus
// web/js/data/economy.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as sim from '../web/js/sim.js';
import { boatTypes, berths } from './fixtures.mjs';

function context() {
  const ctx = sim.createContext({ boatTypes, berths, rules: sim.rulesFromEconomy(ECONOMY) });
  ctx.rules.queue.selfEnterAfter = null;
  ctx.rules.queue.buoyFee = 0; // Bojengeld (P10) prüft tests/zuweisen.test.mjs
  ctx.rules.trips = null;
  ctx.rules.departWindow = null;
  return ctx;
}

function waitingBoat(state, props = {}) {
  const boat = {
    id: state.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S',
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: state.clock, berthId: null,
    wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  };
  state.boats[boat.id] = boat;
  state.queue.push(boat.id);
  return boat;
}

function quietState(props = {}) {
  const s = createState({ seed: 1 });
  Object.assign(s, props);
  s.scheduledDay = s.day;
  s.upcoming = [];
  return s;
}

const tag = (ctx) => ctx.rules.dayLength + ctx.rules.eveningLength;

test('Zahlen aus economy.js: vier Fünftel beim Rundgang, Vorauszahlung, Trinkgeld ab 3 Münzen', () => {
  const ctx = context();
  assert.equal(ctx.rules.roundShare, ECONOMY.kassieren.rundgangAnteil);
  assert.equal(sim.roundShare(ctx), 0.8);
  assert.equal(ctx.rules.prepay, ECONOMY.kassieren.vorausNaechte);
  assert.equal(ctx.rules.strokeTip.from, ECONOMY.kassieren.strichTrinkgeld.abMuenzen);
});

test('Wer drei Nächte bleibt, zahlt beim Anlegen alle drei; morgens wird nur noch versorgt', () => {
  const ctx = context();
  const s = quietState({ money: 0 });
  s.facilities.wc = 1;
  const b = waitingBoat(s, { wishes: ['wc'], nights: 3 });
  const ev = sim.assign(s, ctx, b.id, 'A1').events;
  const fee = ev.find((e) => e.type === 'feeReady');
  const proNacht = sim.nightlyFee(s, ctx, b, 1);
  const grund = sim.nightlyFee(s, ctx, b, 0);
  assert.equal(fee.nights, 3);
  assert.equal(fee.amount, proNacht * 3);
  assert.equal(fee.base, grund * 3, 'Grundpreis aller Nächte');
  assert.equal(fee.bonus, (proNacht - grund) * 3, 'Wunschbonus aller Nächte');
  assert.equal(fee.base + fee.bonus, fee.amount);
  assert.equal(b.paidThrough, s.day + 2);
  sim.collect(s, ctx, b.id);
  assert.equal(s.money, proNacht * 3);
  // Zwei Morgen: keine neue Münze, aber die Wünsche zählen weiter für die Bewertung
  for (let i = 0; i < 2; i++) {
    const morgen = sim.tick(s, ctx, tag(ctx));
    assert.equal(morgen.filter((e) => e.type === 'feeReady').length, 0, 'keine neue Münze');
    assert.equal(b.paid, true);
  }
  assert.equal(b.wishesTotal, 3, 'drei Tage Wünsche geprüft');
  assert.equal(b.wishesMet, 3);
  sim.tick(s, ctx, tag(ctx));
  assert.equal(s.boats[b.id], undefined, 'nach drei Nächten abgereist');
  assert.equal(s.money, proNacht * 3, 'nichts doppelt bezahlt');
});

test('Bleibt ein Gast länger (Sturm), wird jede weitere Nacht einzeln fällig', () => {
  const ctx = context();
  const s = quietState({ money: 0 });
  const b = waitingBoat(s, { nights: 1 });
  sim.assign(s, ctx, b.id, 'A1');
  sim.collect(s, ctx, b.id);
  b.nights += 1;                       // wie mods.extraNights
  const ev = sim.tick(s, ctx, tag(ctx));
  const fee = ev.find((e) => e.type === 'feeReady' && e.boatId === b.id);
  assert.ok(fee, 'neue Münze am Morgen');
  assert.equal(fee.nights, 1);
});

test('Rundgang bringt vier Fünftel und sagt, was die Münze wert war', () => {
  const ctx = context();
  const s = quietState({ money: 0 });
  const b = waitingBoat(s, { nights: 1 });
  sim.assign(s, ctx, b.id, 'A1');
  const voll = b.pendingFee;
  const r = sim.collectOnRound(s, ctx, b.id);
  assert.equal(r.ok, true);
  const c = r.events[0];
  assert.equal(c.round, true);
  assert.equal(c.full, voll);
  assert.equal(c.amount, Math.round(voll * 0.8));
  assert.equal(s.money, Math.round(voll * 0.8));
  assert.equal(b.paid, true);
});

test('Nachts holt der Hafenmeister den Rest mit demselben Anteil, je Boot ein Ereignis', () => {
  const ctx = context();
  const s = quietState({ money: 0 });
  const a = waitingBoat(s, { nights: 2 });
  const c = waitingBoat(s, { nights: 2 });
  sim.assign(s, ctx, a.id, 'A1');
  sim.assign(s, ctx, c.id, 'A2');
  const offen = a.pendingFee + c.pendingFee;
  const ev = sim.tick(s, ctx, tag(ctx));
  const nachts = ev.filter((e) => e.type === 'collected' && e.night);
  assert.equal(nachts.length, 2, 'die Grafik kann jede Münze entfernen');
  assert.ok(nachts.every((e) => e.round));
  const summe = nachts.reduce((x, e) => x + e.amount, 0);
  assert.equal(ev.find((e) => e.type === 'honestyBox').amount, summe);
  assert.equal(s.money, summe);
  assert.ok(Math.abs(summe - offen * 0.8) <= 1);
});

test('Trinkgeld für den langen Strich: erst ab 3 Münzen, wächst, hat eine Obergrenze', () => {
  const ctx = context();
  const t = ctx.rules.strokeTip;
  const s = quietState({ money: 0 });
  assert.equal(sim.strokeTip(s, ctx, t.from - 1, 100).ok, false);
  assert.equal(s.money, 0);
  const drei = sim.strokeTip(s, ctx, t.from, 100);
  assert.equal(drei.ok, true);
  assert.equal(drei.amount, Math.round(100 * t.perCoin));
  assert.equal(drei.events[0].type, 'strokeTip');
  const viele = sim.strokeTip(s, ctx, 50, 100);
  assert.equal(viele.amount, Math.round(100 * t.max));
  assert.equal(s.money, drei.amount + viele.amount);
});
