// Tagesabschluss (docs/tagesabschluss.md): Buchführung je Quelle in sim.js und Bericht bei 'dayEnd'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../web/js/state.js';
import * as sim from '../web/js/sim.js';
import { boatTypes, berths } from './fixtures.mjs';

const ctx = sim.createContext({ boatTypes, berths });
ctx.rules.queue.selfEnterAfter = null;
ctx.rules.trips = null;
ctx.rules.departWindow = null;

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

function quietState() {
  const s = createState({ seed: 1 });
  s.scheduledDay = s.day;
  s.upcoming = [];
  return s;
}

const dayEnd = (events) => events.find((e) => e.type === 'dayEnd');

test('Tagesabschluss: Liegegeld, Rundgang, Services, Tagesziele und Ausgaben landen je Quelle im Bericht', () => {
  const s = quietState();
  s.money = 1000;
  const a = waitingBoat(s);
  const b = waitingBoat(s);
  assert.equal(sim.assign(s, ctx, a.id, 'A1').ok, true);
  assert.equal(sim.assign(s, ctx, b.id, 'A2').ok, true);
  const feeA = s.boats[a.id].pendingFee;
  const feeB = s.boats[b.id].pendingFee;
  assert.ok(feeA > 0 && feeB > 0);
  sim.collect(s, ctx, a.id);
  sim.collectOnRound(s, ctx, b.id);
  sim.addIncome(s, 40, 'services', 'cafe');
  sim.addIncome(s, 25, 'tagesziele');
  assert.equal(sim.spend(s, 80), true);
  const startMoney = 1000;

  const ev = sim.runDay(s, ctx);
  const r = dayEnd(ev).bericht;
  assert.ok(r, 'dayEnd trägt einen Bericht');
  assert.equal(r.tag, 1);
  assert.equal(r.einnahmen.liegegeld, feeA + Math.round(feeB * ctx.rules.uncollectedShare));
  assert.equal(r.details.liegegeld.kassiert, feeA);
  assert.equal(r.details.liegegeld.rundgang, Math.round(feeB * ctx.rules.uncollectedShare));
  assert.equal(r.einnahmen.services, 40);
  assert.equal(r.details.services.cafe, 40);
  assert.equal(r.einnahmen.tagesziele, 25);
  assert.equal(r.ausgaben.bau, 80);
  assert.equal(r.ausgabenSumme, 80);
  assert.equal(r.angelegt, 2);
  assert.equal(r.abgereist, 2, 'beide Gäste bleiben eine Nacht und werden nachts abgerechnet');
  assert.ok(r.bewertung >= 1 && r.bewertung <= 5);
  // Bericht und Kasse passen zusammen
  assert.equal(r.summe, Object.values(r.einnahmen).reduce((x, y) => x + y, 0));
  assert.equal(s.money - startMoney, r.summe - r.ausgabenSumme);
  assert.equal(dayEnd(ev).income, r.summe);
  // Erster Tag mit Einnahmen ist ein Rekord, der Verlauf hebt ihn auf
  assert.equal(r.rekord, true);
  assert.equal(r.besterTag, null);
  assert.deepEqual(s.stats.besterTag, { tag: 1, summe: r.summe });
  assert.equal(s.stats.verlauf.length, 1);
  assert.equal(s.stats.heute, null);
});

test('Tagesabschluss: weggefahrene Boote je Grund, Ruf vorher und nachher', () => {
  const s = quietState();
  const geduld = ctx.rules.queue.patience;
  ctx.rules.queue.patience = 5;
  const c = waitingBoat(s);
  s.boats[c.id].atBuoy = true;
  s.boats[c.id].atBuoySince = 0;
  sim.tick(s, ctx, 10);
  ctx.rules.queue.patience = geduld;
  const r = dayEnd(sim.runDay(s, ctx)).bericht;
  assert.equal(r.weggefahren.patience, 1);
  assert.equal(r.weggefahrenSumme, 1);
  assert.equal(typeof r.ruf.vorher, 'number');
  assert.equal(typeof r.ruf.nachher, 'number');
  assert.equal(r.rekord, false, 'ohne Einnahmen kein Rekord');
});

test('Tagesabschluss: Pacht der stationierten Boote steht unter Pacht', () => {
  const s = quietState();
  const st = sim.stationBoat(s, ctx, 'S1', 'A1');
  assert.equal(st.ok, true);
  const r = dayEnd(sim.runDay(s, ctx)).bericht;
  assert.ok(r.einnahmen.pacht > 0);
  assert.equal(r.angelegt, 0, 'Dauerlieger zählen nicht als neue Gäste');
});

test('Tagesabschluss: Rekord nur, wenn der Tag den besten bisher schlägt', () => {
  const s = quietState();
  sim.addIncome(s, 100, 'sonstiges');
  assert.equal(dayEnd(sim.runDay(s, ctx)).bericht.rekord, true);
  s.scheduledDay = s.day; s.upcoming = [];
  sim.addIncome(s, 60, 'sonstiges');
  const r2 = dayEnd(sim.runDay(s, ctx)).bericht;
  assert.equal(r2.rekord, false);
  assert.deepEqual(r2.besterTag, { tag: 1, summe: 100 });
  s.scheduledDay = s.day; s.upcoming = [];
  sim.addIncome(s, 150, 'sonstiges');
  const r3 = dayEnd(sim.runDay(s, ctx)).bericht;
  assert.equal(r3.rekord, true);
  assert.deepEqual(s.stats.besterTag, { tag: 3, summe: 150 });
});

test('Tagesabschluss: Verlauf hält höchstens VERLAUF_TAGE Tage und übersteht Speichern', () => {
  const s = createState({ seed: 7 });
  for (let i = 0; i < sim.VERLAUF_TAGE + 4; i++) sim.runDay(s, ctx);
  assert.equal(s.stats.verlauf.length, sim.VERLAUF_TAGE);
  assert.equal(s.stats.verlauf.at(-1).tag, s.day - 1);
  const t = deserialize(serialize(s));
  assert.deepEqual(t.stats.verlauf, s.stats.verlauf);
});

test('Tagesabschluss: alter Spielstand ohne Buchführung läuft weiter', () => {
  const s = quietState();
  delete s.stats.heute;
  delete s.stats.verlauf;
  delete s.stats.besterTag;
  s.stats.bestDayIncome = 500;
  sim.addIncome(s, 120, 'liegegeld');
  const r = dayEnd(sim.runDay(s, ctx)).bericht;
  assert.equal(r.summe, 120);
  assert.equal(r.rekord, false, 'der beste Tag aus alten Spielständen zählt mit');
  assert.deepEqual(r.besterTag, { tag: null, summe: 500 });
});

test('Tagesabschluss: über viele echte Tage stimmen Bericht und Kasse überein', () => {
  const live = sim.createContext({ boatTypes, berths });
  const s = createState({ seed: 3 });
  let money = s.money;
  for (let i = 0; i < 12; i++) {
    const ev = sim.runDay(s, live);
    // Ohne Spieler kassiert der Rundgang nicht: alles kommt nachts als Ehrlichkeitskasse
    sim.collectAll(s, live, true);
    const r = dayEnd(ev).bericht;
    assert.ok(Object.keys(r.einnahmen).every((q) => sim.QUELLEN.includes(q)), `bekannte Quellen: ${Object.keys(r.einnahmen)}`);
    assert.equal(r.summe, Object.values(r.einnahmen).reduce((x, y) => x + y, 0));
    money = s.money;
  }
  assert.ok(money > 0);
  assert.ok(s.stats.verlauf.some((r) => r.summe > 0), 'es wurde verdient');
});
