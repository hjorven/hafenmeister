// P10 "Zuweisen wieder zur Entscheidung machen": Wunschplätze,
// Platzwert, passgenau, Abweisen mit derselben Folge wie Ungeduld, Bojengeld über Nacht.
// Mit den echten Zahlen (economy.js) und Liegeplätzen (harbor.js, Grundbild).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as sim from '../web/js/sim.js';

const rules = sim.rulesFromEconomy(ECONOMY);
const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });

function quietState(stage = 1, props = {}) {
  const s = sim.applyTestStage(createState({ seed: 3, rules }), ctx, stage);
  Object.assign(s, props);
  s.scheduledDay = s.day;
  s.upcoming = [];
  s.queue = [];
  for (const [id, b] of Object.entries(s.boats)) if (!b.stationed) { delete s.boats[id]; }
  for (const [pid, bid] of Object.entries(s.berths)) if (!s.boats[bid]) delete s.berths[pid];
  s.leaving = {};
  return s;
}

function waitingBoat(s, props = {}) {
  const boat = {
    id: s.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S',
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: s.clock, atBuoy: true, atBuoySince: s.clock,
    berthId: null, waitSpot: s.queue.length, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  };
  s.boats[boat.id] = boat;
  s.queue.push(boat.id);
  return boat;
}

test('Zahlen aus economy.js: Bojengeld, passgenau', () => {
  assert.equal(rules.queue.buoyFee, ECONOMY.warten.bojengeld);
  assert.equal(rules.snug.share, ECONOMY.passgenau.hoechstensGroesser);
  assert.equal(rules.snug.rating, ECONOMY.passgenau.ruf);
});

test('Wunschplätze: nur Plätze mit Strom leuchten gold, Platzwert rechnet den Wunschbonus', () => {
  const s = quietState(3);
  const boat = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1.2, wishes: ['strom'] });
  const gold = sim.wishBerths(s, ctx, boat.id);
  assert.ok(gold.length > 0);
  for (const id of gold) assert.ok(sim.berthHas(s, ctx, ctx.berthById[id], 'power'));
  const ohne = sim.fittingBerths(s, ctx, boat.id).find((id) => !gold.includes(id));
  assert.ok(ohne, 'es gibt auch passende Plätze ohne Strom');
  const mit = sim.berthValue(s, ctx, boat.id, gold[0]);
  const kein = sim.berthValue(s, ctx, boat.id, ohne);
  assert.deepEqual(mit.wishesMet, ['strom']);
  assert.deepEqual(kein.wishesMet, []);
  assert.ok(mit.fee > kein.fee);
  assert.ok(mit.anchors > kein.anchors);
});

test('Passgenau: Box höchstens ein Fünftel länger als das Boot bringt einen Viertelanker, zu große nicht', () => {
  const s = quietState(2);
  const boat = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8.5, beam: 2.8, draft: 1.2 });
  const passend = sim.fittingBerths(s, ctx, boat.id);
  const klein = passend.find((id) => ctx.berthById[id].maxLength <= 8.5 * 1.2);
  const gross = passend.find((id) => ctx.berthById[id].maxLength > 8.5 * 1.2);
  assert.ok(klein && gross);
  assert.equal(sim.isSnug(s, ctx, boat, ctx.berthById[klein]), true);
  assert.equal(sim.isSnug(s, ctx, boat, ctx.berthById[gross]), false);
  const a = sim.berthValue(s, ctx, boat.id, klein);
  const b = sim.berthValue(s, ctx, boat.id, gross);
  // Bewertungen sind auf ein Zehntel gerundet
  assert.ok(Math.abs(a.anchors - b.anchors - rules.snug.rating) <= 0.051, `${a.anchors} gegen ${b.anchors}`);
  const r = sim.assign(s, ctx, boat.id, klein);
  const ev = r.events.find((e) => e.type === 'moored');
  assert.equal(ev.passgenau, true);
  assert.equal(ev.hand, true);
});

test('Passgenau ist keine Selbstverständlichkeit: kurze Boote der Klasse sind es nirgends', () => {
  const s = quietState(2);
  const kurz = waitingBoat(s, { size: 'M', typeId: 'M1', length: 6.5, beam: 2.5, draft: 1 });
  for (const id of sim.fittingBerths(s, ctx, kurz.id)) assert.equal(sim.isSnug(s, ctx, kurz, ctx.berthById[id]), false);
});

test('Stufe 1 hat nur eine Boxgröße: dort gibt es nichts passgenau zu wählen', () => {
  const s = quietState(1);
  const boat = waitingBoat(s);
  const id = sim.fittingBerths(s, ctx, boat.id)[0];
  assert.equal(sim.isSnug(s, ctx, boat, ctx.berthById[id]), false);
});

test('Einfahren lassen zählt nicht als von Hand zugewiesen', () => {
  const s = quietState(2);
  const boat = waitingBoat(s);
  const r = sim.autoEnter(s, ctx, boat.id);
  assert.equal(r.ok, true);
  assert.equal(r.events.find((e) => e.type === 'moored').hand, undefined);
});

test('Abweisen von Hand und Wegfahren aus Ungeduld haben dieselbe Folge', () => {
  let abweisen = 0, ungeduld = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const s1 = quietState(1, { rng: 100 + i * 7919 });
    const a = waitingBoat(s1);
    for (const p of sim.availableBerths(s1, ctx)) s1.berths[p.id] = 9999; // alles belegt
    const r = sim.dismiss(s1, ctx, a.id);
    assert.equal(r.ok, true);
    if (r.events[0].rated) { abweisen++; assert.equal(s1.ratings.at(-1), rules.turnAway.rating); }

    const s2 = quietState(1, { rng: 100 + i * 7919 });
    const b = waitingBoat(s2);
    for (const p of sim.availableBerths(s2, ctx)) s2.berths[p.id] = 9999;
    const ev = sim.tick(s2, ctx, rules.queue.patience + 1);
    const weg = ev.find((e) => e.type === 'turnedAway' && e.boatId === b.id);
    assert.equal(weg?.reason, 'patience');
    if (weg.rated) ungeduld++;
  }
  // gleiche Wahrscheinlichkeit (rules.turnAway.chance), etwas Spiel für den Zufall
  for (const k of [abweisen, ungeduld]) assert.ok(Math.abs(k / n - rules.turnAway.chance) < 0.08, `${k}/${n}`);
});

test('Wer an keinen Platz des Hafens passt, wird ohne Bewertung abgewiesen', () => {
  const s = quietState(1);
  const riese = waitingBoat(s, { size: 'L', length: 13, beam: 4, draft: 2 });
  for (let i = 0; i < 20; i++) {
    s.rng = i * 7919;
    const b = waitingBoat(s, { size: 'L', length: 13, beam: 4, draft: 2 });
    assert.equal(sim.dismiss(s, ctx, b.id).events[0].rated, false);
  }
  assert.equal(sim.dismiss(s, ctx, riese.id).events[0].rated, false);
});

test('Bojengeld über Nacht und Bojenlieger werden morgens zuerst bedient', () => {
  const s = quietState(2);
  for (const p of sim.availableBerths(s, ctx)) s.berths[p.id] = 9999; // alles belegt
  // kurz vor Abend: Geduld zählt nur tagsüber, das Boot bleibt über Nacht an der Boje
  s.clock = rules.dayLength - 1;
  const alt = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1 });
  const geld = s.money;
  const ev = sim.tick(s, ctx, rules.eveningLength + 3);
  const fee = ev.find((e) => e.type === 'buoyFee');
  assert.ok(fee, 'Bojengeld gebucht');
  assert.equal(fee.amount, Math.round(sim.nightlyFee(s, ctx, alt, 0) * rules.queue.buoyFee));
  assert.ok(s.money >= geld + fee.amount);
  assert.equal(s.boats[alt.id].overnight, 1);
  // Morgens kommt ein neues Boot dazu, dann wird eine Box frei: der Bojenlieger bekommt sie
  const neu = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1 });
  s.queue = [neu.id, alt.id];
  const frei = sim.fittingBerths({ ...s, berths: {} }, ctx, alt.id)[0];
  delete s.berths[frei];
  const ev2 = sim.selfEnter(Object.assign(s, { clock: rules.queue.selfEnterAfter + 1 }), ctx);
  assert.equal(ev2.find((e) => e.type === 'selfEntered')?.boatId, alt.id);
});

test('Bojenlieger warten morgens die Abreisen ab und bekommen die erste frei werdende Box', () => {
  const s = quietState(3);
  for (const p of sim.availableBerths(s, ctx)) s.berths[p.id] = 9999; // alles belegt
  s.clock = rules.dayLength - 1;
  const alt = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1 });
  sim.tick(s, ctx, rules.eveningLength + 3); // über Nacht an der Boje
  assert.equal(s.boats[alt.id]?.overnight, 1);
  s.upcoming = [];
  const morgenEnde = Math.round(rules.departWindow[1] * rules.dayLength + rules.leaveMax);
  assert.ok(morgenEnde > rules.queue.patience, 'die Abreisen dauern länger als die normale Geduld');
  // Nach der normalen Geduld ist der Bojenlieger noch da
  sim.tick(s, ctx, rules.queue.patience + 5 - s.clock);
  assert.equal(s.boats[alt.id]?.status, 'waiting', 'fährt nicht vor den Abreisen weg');
  assert.ok(sim.patienceLeft(s, ctx, alt.id) <= rules.queue.patience);
  // Ein neues Boot kommt dazu, dann wird eine Box frei: der Bojenlieger bekommt sie
  const neu = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1 });
  const frei = sim.fittingBerths({ ...s, berths: {} }, ctx, alt.id)[0];
  delete s.berths[frei];
  const ev = sim.tick(s, ctx, rules.queue.selfEnterAfter + 1);
  assert.equal(ev.find((e) => e.type === 'selfEntered')?.boatId, alt.id);
  assert.equal(s.boats[neu.id].status, 'waiting');
  // Nach den Abreisen zählt die Geduld wieder normal
  const b2 = s.boats[neu.id];
  b2.overnight = 1;
  s.clock = morgenEnde + rules.queue.patience + 1;
  assert.equal(sim.patienceLeft(s, ctx, b2.id), 0);
});

test('Winterbeginn: Bojenlieger von der Nacht fahren weiter, ohne Bewertung und ohne als weggefahren zu zählen', () => {
  const s = quietState(3);
  for (const p of sim.availableBerths(s, ctx)) s.berths[p.id] = 9999; // alles belegt
  s.day = rules.seasonDays;
  s.clock = rules.dayLength - 1;
  s.upcoming = [];
  const alt = waitingBoat(s, { size: 'M', typeId: 'M1', length: 8, beam: 2.8, draft: 1 });
  const weg = s.stats.turnedAway;
  const ev = sim.tick(s, ctx, rules.eveningLength + 3); // über Nacht, erster Wintertag beginnt
  assert.equal(s.day, rules.seasonDays + 1);
  assert.equal(s.boats[alt.id], undefined, 'kein Gast an der Boje im Winter');
  assert.deepEqual(s.queue, []);
  const t = ev.find((e) => e.type === 'turnedAway' && e.boatId === alt.id);
  assert.equal(t?.reason, 'winter');
  assert.equal(t.rated, false);
  const andere = ev.filter((e) => e.type === 'turnedAway' && e.reason !== 'winter').length;
  assert.equal(s.stats.turnedAway, weg + andere, 'Winter zählt nicht als weggefahren');
  assert.ok(ev.filter((e) => e.reason === 'winter').every((e) => e.rated === false));
  assert.equal(sim.waitingBoats(s).length, 0);
});
