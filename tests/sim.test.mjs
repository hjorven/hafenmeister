import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { RULES } from '../web/js/data/rules.js';
import * as sim from '../web/js/sim.js';
import { boatTypes, berths } from './fixtures.mjs';

const ctx = sim.createContext({ boatTypes, berths });
// Die meisten Tests prüfen einzelne Regeln von Hand: Selbst-Einfahren und Tagestörns sind dort aus
// und werden weiter unten eigens geprüft.
ctx.rules.queue.selfEnterAfter = null;
ctx.rules.trips = null;
ctx.rules.departWindow = null;
const ctxLive = sim.createContext({ boatTypes, berths });

/** Testboot direkt in die Warteschlange legen. */
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

/** Spielstand, bei dem heute niemand mehr von selbst kommt. */
function quietState(props = {}) {
  const s = createState({ seed: 1 });
  Object.assign(s, props);
  s.scheduledDay = s.day;
  s.upcoming = [];
  return s;
}

const berth = (id) => ctx.berthById[id];

// ---------------------------------------------------------------------------
test('Passregel: Länge, Breite, Tiefgang mit 0,3 m Abstand', () => {
  const box = { id: 'x', maxLength: 6, maxBeam: 2.4, depth: 2.0 };
  const ok = { size: 'S', length: 6, beam: 2.4, draft: 1.7 };
  assert.equal(sim.whyNotFit(ok, box), null);
  assert.equal(sim.whyNotFit({ ...ok, length: 6.1 }, box), 'length');
  assert.equal(sim.whyNotFit({ ...ok, beam: 2.5 }, box), 'beam');
  assert.equal(sim.whyNotFit({ ...ok, draft: 1.8 }, box), 'draft');
  assert.equal(sim.whyNotFit(ok, { ...box, reserved: true }), 'reserved');
  assert.equal(sim.whyNotFit(ok, { ...box, sizes: ['XL'] }), 'size');
});

test('Katamaran passt nur an den Stirnplatz, Kielyacht nicht in Box S', () => {
  const s = createState({ seed: 1 });
  s.stage = 4;
  s.buildings['steg-d'] = 1;
  const cat = { size: 'L', length: 12, beam: 7, draft: 1.2, wishes: [] };
  const fitting = sim.availableBerths(s, ctx).filter((b) => sim.fits(cat, b)).map((b) => b.id);
  assert.deepEqual(fitting, ['T1']);
  const keel = { size: 'L', length: 11, beam: 3.8, draft: 1.9, wishes: [] };
  assert.equal(sim.fits(keel, berth('A1')), false);
  assert.equal(sim.fits(keel, berth('C1')), true);
});

test('Plätze mit requires gibt es erst nach dem Bauprojekt', () => {
  const s = createState({ seed: 1 });
  s.stage = 4;
  assert.equal(sim.availableBerths(s, ctx).some((b) => b.id === 'D1'), false);
  s.money = 100;
  assert.equal(sim.build(s, 'steg-d', 50).ok, true);
  assert.equal(s.money, 50);
  assert.equal(sim.availableBerths(s, ctx).some((b) => b.id === 'D1'), true);
  assert.equal(sim.build(s, 'steg-d', 0).reason, 'built');
  assert.equal(sim.build(s, 'anderes', 1000).reason, 'money');
});

test('fittingBerths: knappster Platz zuerst, Strom-Wunsch bevorzugt Platz mit Strom', () => {
  const s = quietState({ stage: 3 });
  const small = waitingBoat(s);
  const list = sim.fittingBerths(s, ctx, small.id);
  assert.equal(list[0][0], 'A');
  assert.ok(list.includes('C1'));
  const wantsPower = waitingBoat(s, { wishes: ['strom'] });
  assert.equal(sim.fittingBerths(s, ctx, wantsPower.id)[0][0], 'C');
});

test('assign: Gründe für Ablehnung und belegter Platz', () => {
  const s = quietState();
  const a = waitingBoat(s);
  const big = waitingBoat(s, { length: 8, size: 'M' });
  assert.equal(sim.assign(s, ctx, big.id, 'A1').reason, 'length');
  assert.equal(sim.assign(s, ctx, a.id, 'B1').reason, 'noBerth'); // Stufe 2 fehlt
  assert.equal(sim.assign(s, ctx, a.id, 'A1').ok, true);
  assert.equal(s.berths.A1, a.id);
  assert.deepEqual(s.queue, [big.id]);
  const c = waitingBoat(s);
  assert.equal(sim.assign(s, ctx, c.id, 'A1').reason, 'occupied');
  assert.equal(sim.assign(s, ctx, a.id, 'A2').reason, 'notWaiting');
  assert.deepEqual(sim.fittingBerths(s, ctx, c.id).includes('A1'), false);
});

test('Logbuch trägt neue Modelle einmal ein', () => {
  const s = quietState();
  const a = waitingBoat(s, { modelId: 'S1-1' });
  const r1 = sim.assign(s, ctx, a.id, 'A1');
  assert.ok(r1.events.some((e) => e.type === 'logbookNew'));
  const b = waitingBoat(s, { modelId: 'S1-1' });
  const r2 = sim.assign(s, ctx, b.id, 'A2');
  assert.ok(!r2.events.some((e) => e.type === 'logbookNew'));
  assert.deepEqual(s.logbook, { S1: ['S1-1'] });
});

test('Tag 1: nur Boote der Stufe 1 kommen, verteilt auf den Tag', () => {
  const s = createState({ seed: 5 });
  const ev = sim.tick(s, ctx, 0);
  assert.equal(ev[0].type, 'dayStart');
  assert.ok(s.upcoming.length >= 1);
  for (const b of s.upcoming) {
    assert.equal(b.typeId, 'S1');
    assert.ok(b.arriveAt <= RULES.dayLength * RULES.arrivalWindow);
    assert.ok(b.wishes.every((w) => w === 'wc'));
    assert.ok(b.nights >= 1 && b.nights <= 3);
  }
  assert.ok(sim.preview(s, ctx).length <= RULES.previewCount);
  const all = sim.tick(s, ctx, RULES.dayLength * RULES.arrivalWindow);
  assert.ok(all.some((e) => e.type === 'arrived'));
  assert.equal(s.upcoming.length, 0);
});

test('Warten: wer zu lange wartet oder keinen Platz in der Schlange hat, fährt weiter', () => {
  const s = quietState();
  const b = waitingBoat(s);
  const ev = sim.tick(s, ctx, RULES.queue.patience + 1);
  assert.ok(ev.some((e) => e.type === 'turnedAway' && e.boatId === b.id && e.reason === 'patience'));
  assert.equal(s.boats[b.id], undefined);
  assert.equal(s.stats.turnedAway, 1);

  const t = quietState();
  for (let i = 0; i < RULES.queue.spots[1]; i++) waitingBoat(t, { waitSpot: i });
  const late = { ...waitingBoat(createState({ seed: 2 })), id: 999, arriveAt: 0.5 };
  t.upcoming = [late];
  const ev2 = sim.tick(t, ctx, 1);
  assert.ok(ev2.some((e) => e.type === 'turnedAway' && e.boatId === 999 && e.reason === 'queueFull'));
});

test('Hafenbüro mit Automatik weist wartende Boote zu; volle Bojen kosten keinen Ruf', () => {
  const s = quietState({ office: RULES.office.autoAssign });
  const b = waitingBoat(s, { atBuoy: true, atBuoySince: s.clock });
  assert.ok(sim.fittingBerths(s, ctx, b.id).length > 0);
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[b.id].status, 'moored');
  assert.equal(s.queue.length, 0);

  const t = quietState();
  for (let i = 0; i < RULES.queue.spots[1]; i++) waitingBoat(t, { waitSpot: i });
  const ratings = JSON.stringify(t.ratings);
  t.upcoming = Array.from({ length: 20 }, (_, i) => ({ ...waitingBoat(createState({ seed: 3 })), id: 900 + i, arriveAt: 0.5 }));
  const ev = sim.tick(t, ctx, 1);
  const weg = ev.filter((e) => e.type === 'turnedAway' && e.reason === 'queueFull');
  assert.equal(weg.length, 20);
  assert.ok(weg.every((e) => e.rated === false));
  assert.equal(JSON.stringify(t.ratings), ratings);
});

test('Hafengeld wird beim Anlegen fällig: Wünsche, Kapazität der Toilette, Strom vom Platz', () => {
  const s = quietState({ stage: 3, money: 0 });
  s.facilities.wc = 1; // versorgt 6 Boote am Tag
  const boats = [];
  const fees = [];
  for (let i = 0; i < 7; i++) {
    const b = waitingBoat(s, { wishes: ['wc'] });
    const r = sim.assign(s, ctx, b.id, i < 6 ? `A${i + 1}` : 'B1');
    assert.equal(r.ok, true);
    fees.push(...r.events.filter((e) => e.type === 'feeReady'));
    boats.push(b);
  }
  assert.equal(boats[0].paid, false);
  const yacht = waitingBoat(s, { typeId: 'L1', size: 'L', length: 11, beam: 3.8, draft: 1.9, wishes: ['strom', 'dusche'] });
  fees.push(...sim.assign(s, ctx, yacht.id, 'C1').events.filter((e) => e.type === 'feeReady'));
  const ev = sim.tick(s, ctx, RULES.dayLength);
  assert.equal(s.phase, 'evening');
  assert.equal(ev.filter((e) => e.type === 'feeReady').length, 0, 'abends wird nichts mehr fällig');
  assert.equal(fees.length, 8);
  // 6 Boote mit WC: 10 × 1,25 = 12,5 -> 13; das siebte ohne WC: 10
  assert.deepEqual(fees.slice(0, 7).map((e) => e.amount), [13, 13, 13, 13, 13, 13, 10]);
  // Yacht: Strom ja, Dusche nein -> 40 × 1,25 = 50
  assert.equal(fees[7].amount, 50);
  assert.equal(s.money, 0);
  const c = sim.collect(s, ctx, yacht.id);
  assert.equal(c.ok, true);
  assert.equal(s.money, 50);
  assert.equal(yacht.paid, true);
  assert.equal(sim.collect(s, ctx, yacht.id).ok, false);
});

test('Wer bleibt, zahlt jeden Morgen die nächste Nacht und gilt bis dahin als unbezahlt', () => {
  const s = quietState({ money: 0 });
  const b = waitingBoat(s, { wishes: [], nights: 2 });
  sim.assign(s, ctx, b.id, 'A1');
  assert.equal(b.pendingFee, 10);
  sim.collect(s, ctx, b.id);
  assert.equal(b.paid, true);
  const ev = sim.tick(s, ctx, RULES.dayLength + RULES.eveningLength);
  assert.equal(s.day, 2);
  assert.ok(ev.some((e) => e.type === 'feeReady' && e.boatId === b.id));
  assert.equal(b.paid, false);
  assert.equal(b.pendingFee, 10);
  // Nicht kassiert: nachts landet die Hälfte in der Kasse des Vertrauens, dann reist das Boot ab
  sim.tick(s, ctx, RULES.dayLength + RULES.eveningLength);
  assert.equal(s.money, 15);
  assert.equal(s.boats[b.id], undefined);
});

test('Nacht: halbe Münzen ohne Kassieren, Abreise mit Bewertung, Ruf und Gästezahl', () => {
  const s = quietState({ money: 0 });
  s.facilities.wc = 1;
  const happy = waitingBoat(s, { wishes: ['wc'] });
  const plain = waitingBoat(s, { wishes: [] });
  const stays = waitingBoat(s, { wishes: [], nights: 2 });
  sim.assign(s, ctx, happy.id, 'A1');
  sim.assign(s, ctx, plain.id, 'A2');
  sim.assign(s, ctx, stays.id, 'A3');
  sim.tick(s, ctx, RULES.dayLength);
  sim.collect(s, ctx, happy.id); // 13
  const ev = sim.tick(s, ctx, RULES.eveningLength);
  // plain und stays je 10, nicht kassiert -> je 5
  assert.equal(s.money, 13 + 5 + 5);
  const dep = ev.filter((e) => e.type === 'departed');
  assert.deepEqual(dep.map((e) => e.rating), [5, 4]);
  assert.equal(s.guests, 2);
  assert.equal(s.day, 2);
  assert.equal(s.phase, 'day');
  assert.equal(s.clock, 0);
  assert.equal(s.berths.A3, stays.id);
  assert.equal(s.berths.A1, undefined);
  assert.equal(s.ratings.slice(-2).join(), '5,4');
  assert.ok(ev.some((e) => e.type === 'dayEnd' && e.income === 23));
  assert.equal(s.stats.bestDayIncome, 23);
});

test('Ruf: Schnitt der letzten 20, Faktor für Ankünfte', () => {
  const s = createState({ seed: 1 });
  assert.equal(sim.reputation(s), 3);
  assert.equal(sim.reputationFactor(1), 0.5);
  assert.equal(sim.reputationFactor(3), 1);
  assert.equal(sim.reputationFactor(5), 1.5);
});

test('Bewertung: Komfort, Sondergast und Sturmschaden, begrenzt auf 1 bis 5', () => {
  assert.equal(sim.rateBoat(ctx, { wishesMet: 1, wishesTotal: 2, berthId: 'D1', special: false, penalty: 0 }), 3.5);
  assert.equal(sim.rateBoat(ctx, { wishesMet: 0, wishesTotal: 0, berthId: 'K1', special: true, penalty: 0 }), 5);
  assert.equal(sim.rateBoat(ctx, { wishesMet: 0, wishesTotal: 3, berthId: 'A1', special: false, penalty: 1 }), 1);
});

test('Hafenbüro: Stufe 1 Knopf, Stufe 2 kassiert selbst, Stufe 3 weist selbst zu', () => {
  const s = quietState({ stage: 3 });
  const a = waitingBoat(s);
  sim.assign(s, ctx, a.id, 'A1');
  sim.tick(s, ctx, RULES.dayLength);
  assert.deepEqual(sim.collectAll(s, ctx), []); // ohne Büro kein Knopf
  s.office = 1;
  assert.equal(sim.collectAll(s, ctx).length, 1);

  const t = quietState({ stage: 3, office: 2 });
  const b = waitingBoat(t);
  const ev = sim.assign(t, ctx, b.id, 'A1').events;
  assert.ok(ev.some((e) => e.type === 'collected'), 'Büro kassiert gleich beim Anlegen');
  assert.equal(t.money, 10);

  const u = quietState({ stage: 3, office: 3 });
  u.upcoming = [{ ...waitingBoat(createState({ seed: 3 })), id: 500, status: 'expected', arriveAt: 0.5 }];
  sim.tick(u, ctx, 1);
  assert.equal(u.boats[500].status, 'moored');
  assert.equal(u.boats[500].berthId, 'A1');
});

test('autoAssign verteilt die Warteschlange, wer nicht passt, bleibt', () => {
  const s = quietState();
  const a = waitingBoat(s);
  const tooBig = waitingBoat(s, { length: 8 });
  const ev = sim.autoAssign(s, ctx);
  assert.equal(ev.filter((e) => e.type === 'moored').length, 1);
  assert.equal(s.boats[a.id].status, 'moored');
  assert.deepEqual(s.queue, [tooBig.id]);
});

test('Stationierte Einheit: fester Platz, Pacht, reist nicht ab', () => {
  const s = quietState({ stage: 4 });
  // Gäste dürfen nicht an den Retterplatz
  const g = waitingBoat(s);
  assert.equal(sim.assign(s, ctx, g.id, 'R1').reason, 'reserved');
  assert.equal(sim.stationBoat(s, ctx, 'L4', 'A1').reason, 'length');
  const r = sim.stationBoat(s, ctx, 'L4', 'R1');
  assert.equal(r.ok, true);
  assert.equal(sim.stationBoat(s, ctx, 'L4', 'R1').reason, 'occupied');
  for (let d = 0; d < 3; d++) sim.tick(s, ctx, RULES.dayLength + RULES.eveningLength);
  assert.equal(s.berths.R1, r.boatId);
  assert.ok(s.money >= 3 * 20); // 40 × 0,5 pro Nacht
});

test('Tagesgäste bringen abends Geld, wenn es einen Kiosk gibt', () => {
  const s = quietState({ stage: 5 });
  s.facilities.essen = 2;
  const ship = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 30, beam: 7, draft: 2, dayVisitors: 40 });
  assert.equal(sim.assign(s, ctx, ship.id, 'K1').ok, true);
  const ev = sim.tick(s, ctx, RULES.dayLength);
  const v = ev.find((e) => e.type === 'visitorIncome');
  assert.equal(v.amount, 40 * RULES.visitorSpend * 2);
  assert.equal(s.money, v.amount);
});

test('Sondergast mit eigenem Preis', () => {
  const s = quietState({ stage: 5 });
  const navy = waitingBoat(s, { typeId: 'XL4', size: 'XL', length: 35, beam: 7, draft: 3, special: true });
  const ev = sim.assign(s, ctx, navy.id, 'K1').events;
  assert.equal(ev.find((e) => e.type === 'feeReady').amount, 50);
});

test('Modifikatoren: Sturm verlängert, schadet ungeschützten Plätzen, hält Seeboote fern', () => {
  const c = sim.createContext({ boatTypes, berths });
  const s = quietState({ stage: 5 });
  const ship = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 30, beam: 7, draft: 2, nights: 2 });
  sim.assign(s, c, ship.id, 'K1');
  let storm = false;
  sim.addHook(c, 'modifiers', () => (storm ? { extraNights: 1, seaArrivals: false, satisfaction: { outer: -1 }, arrivalFactor: 0.5 } : null));
  const normalRate = sim.arrivalRate(s, c);
  storm = true;
  assert.equal(sim.arrivalRate(s, c), normalRate * 0.5);
  sim.runDay(s, c);
  assert.equal(s.boats[ship.id].nights, 2); // 2 - 1 + 1
  assert.equal(s.boats[ship.id].penalty, 1);
  assert.ok(s.upcoming.every((b) => !c.typeById[b.typeId].fromSea));
  assert.ok(sim.eligibleTypes(s, c).every((t) => t.minStage < 3));
});

test('Modifikatoren werden kombiniert, fehlerhafte Quellen ignoriert', () => {
  const c = sim.createContext({ boatTypes, berths });
  sim.addHook(c, 'modifiers', () => ({ arrivalFactor: 2, sizeFactor: { L: 2 }, ratingBonus: 0.5, unlock: { kreuzfahrt: true } }));
  sim.addHook(c, 'modifiers', () => ({ arrivalFactor: 1.5, sizeFactor: { L: 3 }, ratingBonus: 0.25 }));
  sim.addHook(c, 'modifiers', () => { throw new Error('kaputt'); });
  const orig = console.error;
  console.error = () => {};
  const m = sim.modifiers(createState({ seed: 1 }), c);
  console.error = orig;
  assert.equal(m.arrivalFactor, 3);
  assert.equal(m.sizeFactor.L, 6);
  assert.equal(m.ratingBonus, 0.75);
  assert.equal(m.unlock.kreuzfahrt, true);
  assert.equal(m.priceFactor, 1);
  const off = sim.addHook(c, 'modifiers', () => ({ priceFactor: 2 }));
  off();
  assert.equal(sim.modifiers(createState({ seed: 1 }), c).priceFactor, 1);
  assert.throws(() => sim.addHook(c, 'gibtsnicht', () => {}), /Unbekannter Hook/);
});

test('Freischaltung: Bootsart mit unlock kommt erst, wenn ein Modul sie freischaltet', () => {
  const types = [...boatTypes, { id: 'X', name: 'Kreuzfahrt', size: 'XL', minStage: 5, unlock: 'kreuzfahrt', length: 30, beam: 7, draft: 3 }];
  const c = sim.createContext({ boatTypes: types, berths });
  const s = createState({ seed: 1 });
  s.stage = 5;
  assert.ok(!sim.eligibleTypes(s, c).some((t) => t.id === 'X'));
  sim.addHook(c, 'modifiers', () => ({ unlock: { kreuzfahrt: true } }));
  assert.ok(sim.eligibleTypes(s, c).some((t) => t.id === 'X'));
});

test('addService: neuer Wunsch mit Gebäude oder vom Liegeplatz', () => {
  const c = sim.createContext({ boatTypes, berths });
  sim.addService(c, 'segelmacher', { levels: { 1: 5 }, cost: { 1: 100 }, fromStage: { 1: 4 }, wishFromStage: 4 });
  sim.addService(c, 'wasser', { berthProp: 'water', wishFromStage: 3 });
  assert.ok(c.rules.wishes[4].includes('segelmacher'));
  assert.ok(!c.rules.wishes[3].includes('segelmacher'));
  assert.ok(c.rules.wishes[3].includes('wasser'));
  assert.equal(c.rules.berthWishes.wasser, 'water');
  // Regeln des Moduls bleiben unberührt
  assert.ok(!RULES.wishes[4].includes('segelmacher'));
  const s = createState({ seed: 1, rules: c.rules });
  s.stage = 4;
  s.money = 100;
  assert.equal(sim.upgradeFacility(s, c, 'segelmacher').ok, true);
});

test('Hooks am Abend, in der Nacht und bei Ankunft', () => {
  const c = sim.createContext({ boatTypes, berths });
  c.rules.queue.selfEnterAfter = null;
  const calls = [];
  sim.addHook(c, 'arrival', ({ boat }) => { boat.wishes = ['wc']; calls.push('arrival'); });
  sim.addHook(c, 'evening', ({ addIncome, boats }) => { addIncome(7); calls.push(`evening:${boats.length}`); });
  sim.addHook(c, 'night', () => calls.push('night'));
  const s = createState({ seed: 3 });
  sim.tick(s, c, 0);
  assert.ok(s.upcoming.every((b) => b.wishes.join() === 'wc'));
  sim.runDay(s, c);
  assert.ok(calls.includes('evening:0'));
  assert.ok(calls.includes('night'));
  assert.ok(s.stats.totalIncome >= 7);
});

test('Jahreslauf: 30 Tage Saison, 3 Tage Winter ohne Gäste', () => {
  const s = createState({ seed: 4 });
  assert.deepEqual(sim.season(s, ctx), { year: 1, day: 1, winter: false });
  s.day = 31;
  assert.equal(sim.season(s, ctx).winter, true);
  s.day = 34;
  assert.deepEqual(sim.season(s, ctx), { year: 2, day: 1, winter: false });
  s.day = 31;
  const ev = sim.tick(s, ctx, 0);
  assert.equal(s.upcoming.length, 0);
  assert.equal(ev[0].winter, true);
});

test('Warteplätze vor dem Hafen: Nummern, Automatisch einfahren, Abweisen', () => {
  const s = quietState();
  s.upcoming = [1, 2, 3, 4].map((i) => ({ ...waitingBoat(createState({ seed: i })), id: 100 + i, status: 'expected', arriveAt: 0.5 }));
  const ev = sim.tick(s, ctx, 1);
  const spots = ev.filter((e) => e.type === 'arrived').map((e) => e.waitSpot);
  assert.deepEqual(spots, [0, 1, 2]); // Stufe 1 hat 3 Warteplätze
  assert.ok(ev.some((e) => e.type === 'turnedAway' && e.boatId === 104));
  const r = sim.autoEnter(s, ctx, 102);
  assert.equal(r.ok, true);
  assert.equal(s.boats[102].waitSpot, null);
  assert.equal(sim.freeWaitSpot(s, ctx), 1);
  assert.equal(sim.dismiss(s, ctx, 101).ok, true);
  assert.equal(s.boats[101], undefined);
  assert.equal(s.stats.turnedAway, 1); // Abweisen zählt nicht als weitergefahren
  assert.equal(sim.autoEnter(s, ctx, 999).reason, 'notWaiting');
});

test('Services kaufen: Stufe, Geld, Höchststufe', () => {
  const s = createState({ seed: 1 });
  assert.equal(sim.upgradeFacility(s, ctx, 'wc').reason, 'money');
  s.money = 1000;
  assert.equal(sim.upgradeFacility(s, ctx, 'wc').ok, true);
  assert.equal(s.money, 920);
  assert.equal(sim.upgradeFacility(s, ctx, 'wc').reason, 'stage');
  assert.equal(sim.upgradeFacility(s, ctx, 'dusche').reason, 'stage');
  assert.equal(sim.facilityUpgrade(s, ctx, 'gibtsnicht'), null);
  s.stage = 5;
  s.money = 1e6;
  for (let i = 0; i < 3; i++) sim.upgradeFacility(s, ctx, 'wc');
  assert.equal(s.facilities.wc, 4);
  assert.equal(sim.upgradeFacility(s, ctx, 'wc').reason, 'max');
  assert.equal(sim.upgradeOffice(s, ctx).ok, true);
  assert.equal(s.office, 1);
});

test('Ausbaustufe: Ziel prüfen und aufsteigen', () => {
  const s = createState({ seed: 1 });
  let c = sim.canAdvanceStage(s, ctx);
  assert.deepEqual(c.missing, ['guests', 'money']);
  s.guests = 25;
  s.money = 500;
  c = sim.canAdvanceStage(s, ctx);
  assert.equal(c.ok, true);
  assert.equal(sim.advanceStage(s, ctx).ok, true);
  assert.equal(s.stage, 2);
  assert.equal(s.money, 100);
  s.stage = 5;
  assert.deepEqual(sim.canAdvanceStage(s, ctx).missing, ['max']);
});

test('Gleicher Seed, gleiche Eingaben: gleiches Spiel, auch nach Speichern mitten im Tag', () => {
  function play(state, days) {
    for (let d = 0; d < days; d++) {
      for (let t = 0; t < 120; t += 5) {
        sim.tick(state, ctx, 5);
        sim.autoAssign(state, ctx);
        if (state.phase === 'evening') sim.collectAll(state, ctx, true);
      }
    }
  }
  const a = createState({ seed: 77 });
  const b = createState({ seed: 77 });
  play(a, 5);
  play(b, 5);
  assert.equal(serialize(a), serialize(b));
  sim.tick(a, ctx, 33);
  const c = deserialize(serialize(a));
  play(a, 3);
  play(c, 3);
  assert.equal(serialize(a), serialize(c));
});

test('Langer Lauf mit Automatik: Zahlen bleiben stimmig', () => {
  const s = createState({ seed: 2026 });
  s.office = 3; // weist selbst zu
  let sumEvents = 0;
  for (let d = 0; d < 120; d++) {
    // Vorspulen: ein ganzer Tag in einem Aufruf
    sumEvents += sim.tick(s, ctx, RULES.dayLength + RULES.eveningLength).length;
    sim.collectAll(s, ctx, true);
    for (const k of Object.keys(RULES.facilities)) sim.upgradeFacility(s, ctx, k);
    if (s.stage >= 4) sim.build(s, 'steg-d', 0);
    sim.advanceStage(s, ctx);
    // Stimmigkeit
    assert.ok(s.money >= 0);
    assert.ok(s.ratings.length <= RULES.reputation.window);
    assert.ok(s.ratings.every((r) => r >= 1 && r <= 5));
    for (const [berthId, boatId] of Object.entries(s.berths)) {
      const boat = s.boats[boatId];
      assert.equal(boat.berthId, berthId);
      assert.ok(sim.fits(boat, ctx.berthById[berthId]));
    }
    for (const b of Object.values(s.boats)) {
      if (b.status === 'moored') assert.equal(s.berths[b.berthId], b.id);
    }
  }
  assert.equal(s.day, 121);
  assert.ok(s.stage >= 2, `Stufe ${s.stage}`);
  assert.ok(s.guests > 100, `Gäste ${s.guests}`);
  assert.ok(sumEvents > 0);
});

test('Ohne Bootsdaten läuft der Tag trotzdem', () => {
  const empty = sim.createContext({ boatTypes: [], berths });
  const s = createState({ seed: 1 });
  const ev = sim.tick(s, empty, RULES.dayLength + RULES.eveningLength);
  assert.ok(ev.some((e) => e.type === 'dayEnd'));
  assert.equal(s.day, 2);
});

test('createContext lehnt Bootsart ohne id ab', () => {
  assert.throws(() => sim.createContext({ boatTypes: [{ name: 'x' }] }), /ohne id/);
});

test('Geduld zählt erst an der Boje: Meldung der 3D-Ansicht oder Rückfallzeit', () => {
  const s = quietState();
  const make = (id) => ({ ...waitingBoat(createState({ seed: id })), id, status: 'expected', arriveAt: 0.5, atBuoy: false, atBuoySince: null });
  s.upcoming = [make(201), make(202)];
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[201].atBuoy, false);
  // 201 meldet die 3D-Ansicht nach 20 s an der Boje
  sim.tick(s, ctx, 20);
  const ev = sim.markAtBuoy(s, ctx, 201).events;
  assert.equal(ev[0].type, 'atBuoy');
  assert.equal(sim.markAtBuoy(s, ctx, 201).ok, false);
  assert.equal(sim.patienceLeft(s, ctx, 202), RULES.queue.patience);
  // 202 gilt nach approachMax als angekommen
  const ev2 = sim.tick(s, ctx, RULES.queue.approachMax - 20);
  assert.ok(ev2.some((e) => e.type === 'atBuoy' && e.boatId === 202));
  // Nach der vollen Geduld ab der Boje fährt 201 weiter, nicht schon ab Ankunft
  sim.tick(s, ctx, RULES.queue.patience - (RULES.queue.approachMax - 20) - 1);
  assert.ok(s.boats[201], 'noch da: Geduld läuft erst seit der Boje');
  const ev3 = sim.tick(s, ctx, 3);
  assert.ok(ev3.some((e) => e.type === 'turnedAway' && e.boatId === 201 && e.reason === 'patience'));
  assert.ok(s.boats[202], '202 kam später an der Boje an');
});

test('Nach dem Laden liegen wartende Boote an der Boje', async () => {
  const sim = await import('../web/js/sim.js');
  const state = { clock: 100, boats: { 1: { status: 'waiting', atBuoy: false, atBuoySince: null }, 2: { status: 'moored' } } };
  sim.settleWaiting(state);
  assert.equal(state.boats[1].atBuoy, true);
  assert.equal(state.boats[1].atBuoySince, 100);
  assert.equal(state.boats[2].atBuoy, undefined);
});

test('Box bleibt belegt, bis das abreisende Boot heraus ist (Meldung oder Rückfallzeit)', () => {
  const s = quietState();
  const a = waitingBoat(s, { wishes: [], nights: 1 });
  const b = waitingBoat(s, { wishes: [], nights: 1 });
  sim.assign(s, ctx, a.id, 'A1');
  sim.assign(s, ctx, b.id, 'A2');
  sim.tick(s, ctx, RULES.dayLength + RULES.eveningLength); // Nacht: beide reisen ab
  assert.equal(s.day, 2);
  assert.equal(s.berths.A1, undefined);
  assert.ok(!sim.isFree(s, 'A1') && !sim.isFree(s, 'A2'));
  // Neues Boot darf nicht in die Box, aus der gerade jemand ablegt
  const c = waitingBoat(s, { wishes: [], length: 4, beam: 1.5, draft: 0.3 });
  assert.equal(sim.assign(s, ctx, c.id, 'A1').reason, 'occupied');
  assert.ok(!sim.fittingBerths(s, ctx, c.id).some((x) => x.id === 'A1' || x.id === 'A2'));
  const auto = sim.autoEnter(s, ctx, c.id);
  assert.ok(auto.ok);
  assert.ok(!['A1', 'A2'].includes(s.boats[c.id].berthId));
  // 3D-Ansicht meldet: A1 ist frei
  const ev = sim.berthCleared(s, ctx, { boatId: a.id }).events;
  assert.deepEqual(ev.map((e) => [e.type, e.berthId]), [['berthFreed', 'A1']]);
  assert.ok(sim.isFree(s, 'A1'));
  assert.ok(!sim.isFree(s, 'A2'));
  // Ohne Meldung wird A2 nach leaveMax frei
  const ev2 = sim.tick(s, ctx, RULES.leaveMax);
  assert.ok(ev2.some((e) => e.type === 'berthFreed' && e.berthId === 'A2'));
  assert.ok(sim.isFree(s, 'A2'));
  // Nach dem Laden ist nichts mehr im Ablegen
  s.leaving = { A6: { boatId: 99, elapsed: 0 } };
  sim.settleWaiting(s);
  assert.ok(sim.isFree(s, 'A6'));
});

test('Erster Tag: das erste Boot kommt nach wenigen Sekunden', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = createState({ seed });
    const ev = sim.tick(s, ctx, RULES.firstArrivalAt + 1);
    assert.ok(ev.some((e) => e.type === 'arrived'), `Seed ${seed}`);
  }
});

test('Wartende Boote fahren nach kurzer Zeit selbst in eine passende freie Box', () => {
  const s = quietState({ stage: 3 });
  const after = RULES.queue.selfEnterAfter;
  const b = waitingBoat(s, { wishes: ['strom'], atBuoy: true, atBuoySince: 0 });
  const held = waitingBoat(s, { atBuoy: true, atBuoySince: 0 });
  const big = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 30, beam: 7, draft: 2, atBuoy: true, atBuoySince: 0 });
  sim.holdBoat(s, held.id);
  sim.tick(s, ctxLive, after - 1);
  assert.equal(b.status, 'waiting', 'erst kurz warten, Zeit zum Lenken');
  const ev = sim.tick(s, ctxLive, 2);
  assert.equal(b.status, 'moored');
  // nimmt die knappste passende Box, nicht die mit Strom (das lohnt sich nur von Hand)
  assert.equal(b.berthId, 'A1');
  assert.ok(ev.some((e) => e.type === 'selfEntered' && e.boatId === b.id));
  assert.ok(ev.some((e) => e.type === 'feeReady' && e.boatId === b.id));
  assert.equal(held.status, 'waiting', 'gehaltenes Boot bleibt an der Boje');
  assert.equal(big.status, 'waiting', 'ohne passende Box wartet das Boot weiter');
  sim.holdBoat(s, held.id, false);
  sim.tick(s, ctxLive, 1);
  assert.equal(held.status, 'moored');
  assert.notEqual(held.berthId, 'A1', 'nie in eine belegte Box');
});

test('Tagestörn: nur mit mehreren Nächten, Box bleibt belegt, abends zurück', () => {
  const c = sim.createContext({ boatTypes, berths });
  c.rules.queue.selfEnterAfter = null;
  c.rules.trips = { chance: 1, out: [0.2, 0.2], back: [0.7, 0.7] };
  const s = quietState({ money: 0 });
  const stays = waitingBoat(s, { nights: 3 });
  const goes = waitingBoat(s, { nights: 1 });
  sim.assign(s, c, stays.id, 'A1');
  sim.assign(s, c, goes.id, 'A2');
  const D = c.rules.dayLength;
  sim.tick(s, c, D + c.rules.eveningLength); // Tag 2 beginnt
  assert.equal(s.boats[goes.id], undefined);
  assert.ok(stays.trip && !stays.trip.away);
  assert.equal(sim.berthState(s, c, 'A1'), 'belegt');
  const out = sim.tick(s, c, 0.2 * D + 1);
  assert.ok(out.some((e) => e.type === 'tripOut' && e.boatId === stays.id && e.berthId === 'A1'));
  assert.equal(sim.berthState(s, c, 'A1'), 'ausflug');
  assert.equal(sim.isFree(s, 'A1'), false);
  const guest = waitingBoat(s);
  assert.equal(sim.assign(s, c, guest.id, 'A1').reason, 'occupied');
  assert.ok(!sim.fittingBerths(s, c, guest.id).includes('A1'));
  assert.equal(sim.selfBerth(s, c, guest.id) !== 'A1', true);
  const back = sim.tick(s, c, 0.5 * D);
  assert.ok(back.some((e) => e.type === 'tripBack' && e.boatId === stays.id));
  assert.equal(sim.berthState(s, c, 'A1'), 'belegt');
  assert.equal(sim.berthState(s, c, 'A3'), 'frei');
  assert.equal(sim.berthState(s, c, 'R1'), 'aus');
  // Sturm (keine Ankünfte über See): kein Törn
  sim.addHook(c, 'modifiers', () => ({ seaArrivals: false }));
  sim.tick(s, c, D + c.rules.eveningLength);
  assert.equal(stays.trip, null);
});

test('Abschlussziel der Region: Besuche großer Schiffe, Ruf, alle Plätze', () => {
  const c = sim.createContext({ boatTypes, berths });
  c.rules.maxStage = 5;
  c.rules.regionGoal = { bigVisits: 2, reputation: 4, allBerths: true };
  const s = quietState({ stage: 4 });
  assert.equal(sim.regionGoal(s, c).active, false);
  assert.deepEqual(sim.addBigVisit(s, c), []);
  s.stage = 5;
  s.ratings = Array(20).fill(5);
  let g = sim.regionGoal(s, c);
  assert.deepEqual(g.missing, ['bigVisits', 'berths']); // Steg D (requires steg-d) fehlt noch
  s.buildings['steg-d'] = 1;
  assert.deepEqual(sim.addBigVisit(s, c), []);
  const ev = sim.addBigVisit(s, c);
  assert.equal(ev[0].type, 'regionDone');
  assert.deepEqual(sim.addBigVisit(s, c), [], 'nur einmal melden');
  assert.equal(sim.regionGoal(s, c).ok, true);
});

test('Tagesrhythmus: Ankünfte ab dem späten Vormittag, Wartende bleiben über Nacht an der Boje', () => {
  const c = sim.createContext({ boatTypes, berths });
  const D = c.rules.dayLength;
  // Ankunftsfenster (Tag 2, damit das frühe erste Boot von Tag 1 nicht stört)
  const s = createState({ seed: 11 });
  s.stage = 3;
  s.day = 2;
  sim.tick(s, c, 0);
  assert.ok(s.upcoming.length > 0);
  assert.ok(s.upcoming.every((b) => b.arriveAt >= c.rules.arrivalFrom * D && b.arriveAt <= c.rules.arrivalWindow * D));
  // Ein Boot, das nirgends passt, bleibt abends an der Boje und hat morgens wieder volle Geduld
  const t = quietState({ stage: 1 });
  const big = waitingBoat(t, { typeId: 'L1', size: 'L', length: 11, beam: 3.8, draft: 1.9, atBuoy: true, atBuoySince: D - 5 });
  const ratings = JSON.stringify(t.ratings);
  const ev = sim.tick(t, c, D + c.rules.eveningLength);
  assert.equal(t.day, 2);
  assert.ok(!ev.some((e) => e.type === 'turnedAway'));
  assert.equal(t.boats[big.id].status, 'waiting');
  assert.equal(sim.patienceLeft(t, c, big.id), c.rules.queue.patience);
  assert.equal(JSON.stringify(t.ratings), ratings);
  // Am nächsten Tag läuft die Geduld ab
  const ev2 = sim.tick(t, c, c.rules.queue.patience + 2);
  assert.ok(ev2.some((e) => e.type === 'turnedAway' && e.reason === 'patience'));
});

test('Abreise gestaffelt am Vormittag: Box bleibt bis zum Ablegen belegt', () => {
  const c = sim.createContext({ boatTypes, berths });
  c.rules.queue.selfEnterAfter = null;
  c.rules.departWindow = [0.2, 0.2];
  const D = c.rules.dayLength;
  const s = quietState();
  const a = waitingBoat(s, { nights: 1 });
  sim.assign(s, c, a.id, 'A1');
  const night = sim.tick(s, c, D + c.rules.eveningLength);
  const dep = night.find((e) => e.type === 'departed');
  assert.equal(dep.leaveAt, 0.2 * D);
  assert.equal(s.guests, 1, 'abgerechnet wird nachts');
  assert.equal(sim.berthState(s, c, 'A1'), 'belegt');
  assert.ok(!sim.tick(s, c, 0.2 * D - 2).some((e) => e.type === 'castOff'));
  assert.equal(sim.isFree(s, 'A1'), false);
  const ev = sim.tick(s, c, 3);
  assert.ok(ev.some((e) => e.type === 'castOff' && e.boatId === a.id && e.berthId === 'A1'));
  assert.equal(sim.isFree(s, 'A1'), false, 'noch in der Box, bis es heraus ist');
  sim.berthCleared(s, c, { boatId: a.id });
  assert.equal(sim.isFree(s, 'A1'), true);
});
