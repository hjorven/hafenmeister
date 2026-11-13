// Hafenbüro (Roadmap P02): Knopf "Kassieren" erst mit dem Hafenmeister, Automatik lässt Sonderfälle
// beim Spieler (plan.md Abschnitt 3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { RULES } from '../web/js/data/rules.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as sim from '../web/js/sim.js';
import { boatTypes, berths } from './fixtures.mjs';

const SONDER = { kinds: ['mehrrumpf'], sizes: ['XL', 'XXL'], specialGuests: true, onlyBerth: true, selfEnterAfter: 25 };

function context() {
  const rules = structuredClone(RULES);
  rules.office = { ...rules.office, special: { ...SONDER } };
  rules.trips = null;
  rules.departWindow = null;
  return sim.createContext({ boatTypes, berths, rules });
}

function waitingBoat(state, props = {}) {
  const boat = {
    id: state.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S', kind: null,
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: state.clock, berthId: null,
    atBuoy: true, atBuoySince: state.clock, waitSpot: state.queue.length,
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

test('Zahlen aus economy.js: Kassieren-Knopf mit Stufe 1, Sonderfälle mit Wartezeit', () => {
  const r = sim.rulesFromEconomy(ECONOMY);
  assert.equal(r.office.collectAllButton, 1);
  assert.deepEqual(r.office.special.kinds, ECONOMY.hafenbuero.sonderfaelle.arten);
  assert.deepEqual(r.office.special.sizes, ECONOMY.hafenbuero.sonderfaelle.klassen);
  assert.equal(r.office.special.selfEnterAfter, ECONOMY.hafenbuero.sonderfaelle.selbstEinfahrenNach);
  assert.ok(r.office.special.selfEnterAfter > r.queue.selfEnterAfter, 'Sonderfälle warten länger als normale Boote');
  assert.ok(r.office.special.selfEnterAfter < r.queue.patience, 'Sonderfälle fahren ein, bevor die Geduld endet');
});

test('Ohne Stufe für allesKassieren gibt es den Knopf von Anfang an', () => {
  const E = structuredClone(ECONOMY);
  for (const st of E.hafenbuero.stufen) st.schaltetFrei = (st.schaltetFrei ?? []).filter((k) => k !== 'allesKassieren');
  const r = sim.rulesFromEconomy(E);
  assert.equal(r.office.collectAllButton, 0);
  const ctx = sim.createContext({ boatTypes, berths, rules: r });
  const s = quietState();
  const b = waitingBoat(s);
  sim.assign(s, ctx, b.id, 'A1');
  assert.equal(sim.collectAll(s, ctx).length, 1);
});

test('Ohne Hafenmeister kein Alles-Kassieren, mit Stufe 1 schon', () => {
  const ctx = context();
  const s = quietState();
  const b = waitingBoat(s);
  sim.assign(s, ctx, b.id, 'A1');
  assert.ok(s.boats[b.id].pendingFee > 0);
  assert.deepEqual(sim.collectAll(s, ctx), []);
  s.office = 1;
  assert.equal(sim.collectAll(s, ctx).length, 1);
  assert.equal(s.boats[b.id].pendingFee, 0);
});

test('Sonderfälle: Mehrrumpf, große Schiffe, Sondergäste, nur eine passende Box', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 4 });
  const kat = waitingBoat(s, { typeId: 'L2', size: 'L', kind: 'mehrrumpf', length: 11, beam: 6.5, draft: 1.1 });
  const xl = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 25, beam: 7, draft: 2 });
  const gast = waitingBoat(s, { typeId: 'L1', size: 'L', length: 12, beam: 4, draft: 1.8, special: true });
  const normal = waitingBoat(s, { size: 'M', length: 8, beam: 2.6, draft: 1 });
  assert.equal(sim.officeSpecialCase(s, ctx, kat.id), 'mehrrumpf');
  assert.equal(sim.officeSpecialCase(s, ctx, xl.id), 'gross');
  assert.equal(sim.officeSpecialCase(s, ctx, gast.id), 'sondergast');
  assert.equal(sim.officeSpecialCase(s, ctx, normal.id), null);

  // Nur noch eine Box frei, in die das Boot passt
  const t = quietState({ stage: 1, office: 4 });
  for (let i = 1; i <= 5; i++) t.berths[`A${i}`] = 1000 + i;
  const knapp = waitingBoat(t);
  assert.deepEqual(sim.fittingBerths(t, ctx, knapp.id), ['A6']);
  assert.equal(sim.officeSpecialCase(t, ctx, knapp.id), 'einzigerPlatz');
});

test('Hafenbüro weist Standardfälle zu, Sonderfälle warten auf den Spieler', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 4 });
  const xl = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 25, beam: 7, draft: 2 });
  const normal = waitingBoat(s, { size: 'M', length: 8, beam: 2.6, draft: 1 });
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[normal.id].status, 'moored');
  assert.equal(s.boats[xl.id].status, 'waiting');
  // Länger als normale Boote (8 s), aber nicht ewig: nach 25 s an der Boje fährt das Schiff selbst ein
  sim.tick(s, ctx, 15);
  assert.equal(s.boats[xl.id].status, 'waiting');
  sim.tick(s, ctx, 12);
  assert.equal(s.boats[xl.id].status, 'moored');
  assert.equal(s.boats[xl.id].selfEntered, true);
});

test('Spieler weist einen Sonderfall selbst zu', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 4 });
  const kat = waitingBoat(s, { typeId: 'L2', size: 'L', kind: 'mehrrumpf', length: 11, beam: 6.5, draft: 1.1 });
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[kat.id].status, 'waiting');
  const r = sim.assign(s, ctx, kat.id, 'T1');
  assert.ok(r.ok);
  assert.equal(s.boats[kat.id].berthId, 'T1');
});

test('Ankunft eines Sonderfalls meldet officeSpecial, Standardboot legt sofort an', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 4 });
  const ankunft = (props) => ({
    id: s.nextId++, typeId: 'S1', name: 'Test', size: 'S', kind: null, length: 4, beam: 1.4, draft: 0.2,
    motor: false, special: false, dayVisitors: 0, stationed: false, wishes: [], nights: 1,
    status: 'expected', arriveAt: s.dayTime ?? 0, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  });
  const xl = ankunft({ typeId: 'XL3', size: 'XL', length: 25, beam: 7, draft: 2 });
  const s1 = ankunft({});
  s.upcoming = [xl, s1];
  const ev = sim.tick(s, ctx, 1);
  assert.ok(ev.some((e) => e.type === 'officeSpecial' && e.boatId === xl.id && e.reason === 'gross'));
  assert.equal(s.boats[s1.id].status, 'moored');
  assert.equal(s.boats[xl.id].status, 'waiting');
});

test('Hafen schauen weist auch Sonderfälle zu', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 4 });
  const xl = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 25, beam: 7, draft: 2 });
  assert.deepEqual(sim.autoAssign(s, ctx, { standardOnly: true }).filter((e) => e.boatId === xl.id), []);
  sim.autoAssign(s, ctx);
  assert.equal(s.boats[xl.id].status, 'moored');
});

test('Ohne Leitstelle gibt es keine Sonderfälle, alle fahren nach 8 s selbst ein', () => {
  const ctx = context();
  const s = quietState({ stage: 5, office: 3 });
  const xl = waitingBoat(s, { typeId: 'XL3', size: 'XL', length: 25, beam: 7, draft: 2 });
  assert.equal(sim.officeAutomatic(s, ctx), false);
  sim.tick(s, ctx, 9);
  assert.equal(s.boats[xl.id].status, 'moored');
});

// ---------------------------------------------------------------------------
// Detailpunkte E2, E3, E5, E6 und A2 (Roadmap Abschnitt 13)

function liegend(s, ctx, props) {
  const b = waitingBoat(s, props);
  const platz = sim.fittingBerths(s, ctx, b.id)[0];
  sim.assign(s, ctx, b.id, platz);
  return s.boats[b.id];
}

test('E2: Kassenautomat nimmt nur S und M, große Boote geben beim Abholen Trinkgeld', () => {
  const rules = sim.rulesFromEconomy(ECONOMY);
  rules.trips = null;
  const ctx = sim.createContext({ boatTypes, berths, rules });
  const s = quietState({ stage: 3, office: 2 });
  const m = liegend(s, ctx, { size: 'M', length: 8, beam: 2.6, draft: 1 });
  const l = liegend(s, ctx, { size: 'L', length: 12, beam: 4, draft: 1.8 });
  assert.equal(m.pendingFee, 0, 'M wird vom Automaten kassiert');
  assert.ok(l.pendingFee > 0, 'L zahlt persönlich');
  assert.equal(sim.handCollectFor(s, ctx, 'M'), false);
  assert.equal(sim.handCollectFor(s, ctx, 'L'), true);
  const fee = l.pendingFee;
  const ev = sim.collect(s, ctx, l.id, { hand: true }).events[0];
  assert.equal(ev.hand, true);
  assert.equal(ev.tip, Math.round(fee * ECONOMY.hafenbuero.trinkgeld.anteil));
  assert.equal(ev.amount, fee + ev.tip);
  // Über den Knopf (ohne hand) gibt es kein Trinkgeld
  const l2 = liegend(s, ctx, { size: 'L', length: 12, beam: 4, draft: 1.8 });
  const ev2 = sim.collectAll(s, ctx).find((e) => e.boatId === l2.id);
  assert.equal(ev2.tip, undefined);
});

test('Hafenbüro (Stufe 3) rechnet Strom, Wasser und Duschen ab, vorher nicht', () => {
  const rules = sim.rulesFromEconomy(ECONOMY);
  rules.trips = null;
  const ctx = sim.createContext({ boatTypes, berths, rules });
  const anteil = ECONOMY.hafenbuero.nebenkosten.anteil;
  assert.ok(anteil > 0);
  assert.equal(rules.office.extras, 3, 'Nebenkosten gehören zum Hafenbüro');
  for (const office of [0, 1, 2]) {
    const s = quietState({ stage: 3, office });
    const l = liegend(s, ctx, { size: 'L', length: 12, beam: 4, draft: 1.8 });
    const ev = sim.collect(s, ctx, l.id).events[0];
    assert.equal(ev.extras, undefined, `Bürostufe ${office}: keine Nebenkosten`);
  }
  const s = quietState({ stage: 3, office: 3 });
  const l = liegend(s, ctx, { size: 'L', length: 12, beam: 4, draft: 1.8 });
  const fee = l.pendingFee;
  const vorher = s.money;
  const ev = sim.collect(s, ctx, l.id, { hand: true }).events[0];
  assert.equal(ev.extras, Math.round(fee * anteil));
  assert.equal(ev.amount, fee + ev.tip + ev.extras);
  assert.equal(s.money - vorher, ev.amount);
  // Tagesabschluss (P15): Liegegeld, Trinkgeld und Nebenkosten getrennt
  const d = sim.heute(s).details.liegegeld;
  assert.equal(d.trinkgeld, ev.tip);
  assert.ok(d.nebenkosten >= ev.extras);
  // Auch der Automat rechnet sie mit ab (S und M beim Festmachen)
  const m = liegend(s, ctx, { size: 'M', length: 8, beam: 2.6, draft: 1 });
  assert.equal(m.pendingFee, 0);
  // Der Rundgang am Abend nimmt nur den Anteil des Liegegelds, ohne Nebenkosten
  const l2 = liegend(s, ctx, { size: 'L', length: 12, beam: 4, draft: 1.8 });
  const r = sim.collectOnRound(s, ctx, l2.id).events[0];
  assert.equal(r.extras, undefined);
});

test('A2 und E3: Einfahren lassen ohne Büro nimmt die knappste Box, mit Büro den Vorschlag', () => {
  const ctx = context();
  ctx.rules.office.propose = 3;
  ctx.rules.office.autoAssign = 4; // wie in economy.js: volle Automatik erst mit der Leitstelle
  const s = quietState({ stage: 3, office: 0 });
  s.facilities = { ...s.facilities };
  const b = waitingBoat(s, { size: 'S', wishes: ['strom'] });
  assert.equal(sim.officeProposal(s, ctx, b.id), null, 'ohne Büro kein Vorschlag');
  const knapp = sim.selfBerth(s, ctx, b.id);
  sim.autoEnter(s, ctx, b.id);
  assert.equal(s.boats[b.id].berthId, knapp);

  const t = quietState({ stage: 3, office: ctx.rules.office.propose });
  const c = waitingBoat(t, { size: 'S', wishes: ['strom'] });
  const vorschlag = sim.officeProposal(t, ctx, c.id);
  assert.equal(vorschlag, sim.fittingBerths(t, ctx, c.id)[0]);
  assert.ok(ctx.berthById[vorschlag].power, 'Vorschlag erfüllt den Stromwunsch');
  sim.autoEnter(t, ctx, c.id);
  assert.equal(t.boats[c.id].berthId, vorschlag);
  // Vorschlag heißt nicht zuweisen: ohne Spieler bleibt das Boot liegen, bis es selbst einfährt
  const d = waitingBoat(t, { size: 'S' });
  sim.tick(t, ctx, 1);
  assert.equal(t.boats[d.id].status, 'waiting');
});

test('E5: Automatik je Größenklasse abschaltbar', () => {
  const ctx = context();
  const s = quietState({ stage: 3, office: 4 });
  sim.setOfficeAuto(s, 'M', false);
  assert.equal(sim.handAssignFor(s, ctx, 'M'), true);
  assert.equal(sim.handAssignFor(s, ctx, 'S'), false);
  const m = waitingBoat(s, { size: 'M', length: 8, beam: 2.6, draft: 1 });
  const k = waitingBoat(s, { size: 'S' });
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[k.id].status, 'moored');
  assert.equal(s.boats[m.id].status, 'waiting');
  // Abgeschaltete Klasse fährt wie ohne Büro nach 8 s selbst ein (kein Sonderfall)
  sim.tick(s, ctx, 8);
  assert.equal(s.boats[m.id].status, 'moored');
});

test('E6: Von Hand eingewiesene Gäste bewerten einen Viertelanker besser', () => {
  const rules = sim.rulesFromEconomy(ECONOMY);
  const ctx = sim.createContext({ boatTypes, berths, rules });
  const s = quietState();
  const hand = liegend(s, ctx, {});
  const auto = { ...hand, byHand: false };
  assert.equal(hand.byHand, true);
  const d = sim.rateBoat(ctx, hand) - sim.rateBoat(ctx, auto);
  assert.ok(Math.abs(d - ECONOMY.hafenbuero.vonHandBonus) < 0.051, `Unterschied ${d}`);
});

test('Einmal Sonderfall, immer Sonderfall: "nur eine Box" bleibt, auch wenn Boxen frei werden', () => {
  const ctx = context();
  const s = quietState({ stage: 1, office: 4 });
  for (let i = 1; i <= 5; i++) s.berths[`A${i}`] = 1000 + i;
  const knapp = waitingBoat(s);
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[knapp.id].status, 'waiting');
  assert.equal(s.boats[knapp.id].officeCase, 'einzigerPlatz');
  for (let i = 1; i <= 5; i++) delete s.berths[`A${i}`];
  sim.tick(s, ctx, 1);
  assert.equal(s.boats[knapp.id].status, 'waiting', 'die Leitstelle nimmt ihn nicht doch noch');
  assert.equal(sim.officeSpecialCase(s, ctx, knapp.id), 'einzigerPlatz');
});
