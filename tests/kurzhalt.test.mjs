// Längere Tage und Kurzhalt (docs/bootsgeschichten.md, Abschnitt 3): Boote, die nur kurz anlegen
// und am selben Tag wieder ablegen. Mit den echten Zahlen (economy.js) und Liegeplätzen (harbor.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as sim from '../web/js/sim.js';

const rules = sim.rulesFromEconomy(ECONOMY);
const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });

function quietState(stage = 1) {
  const s = sim.applyTestStage(createState({ seed: 3, rules }), ctx, stage);
  s.scheduledDay = s.day;
  s.upcoming = [];
  s.queue = [];
  for (const [id, b] of Object.entries(s.boats)) if (!b.stationed) delete s.boats[id];
  for (const [pid, bid] of Object.entries(s.berths)) if (!s.boats[bid]) delete s.berths[pid];
  s.leaving = {};
  return s;
}

function waitingBoat(s, props = {}) {
  const boat = {
    id: s.nextId++, typeId: 'S1', modelId: null, name: 'Test', size: 'S',
    length: 4, beam: 1.4, draft: 0.2, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 0, stay: 0.2, status: 'waiting', arriveAt: 0, waitingSince: s.clock, atBuoy: true, atBuoySince: s.clock,
    berthId: null, waitSpot: s.queue.length, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props,
  };
  s.boats[boat.id] = boat;
  s.queue.push(boat.id);
  return boat;
}

test('Zahlen: Tag 270 s, Kurzhalt-Regeln aus economy.js', () => {
  assert.equal(rules.dayLength, ECONOMY.zeit.tagSekunden);
  assert.ok(rules.dayLength >= 240, 'ein Tag dauert mehrere Minuten');
  assert.ok(rules.shortStay);
  assert.deepEqual(rules.shortStay.stay, ECONOMY.kurzhalt.bleibt);
  assert.ok(rules.shortStay.fee > 0 && rules.shortStay.fee < 1, 'Tagesliegegeld ist weniger als eine Nacht');
});

test('Kurzhalter: legt am selben Tag ab, zahlt Tagesliegegeld, zählt als Gast, Box wird frei', () => {
  const s = quietState(1);
  s.clock = 20;
  const b = waitingBoat(s);
  const berth = sim.fittingBerths(s, ctx, b.id)[0];
  const r = sim.assign(s, ctx, b.id, berth);
  assert.ok(r.ok);
  const fee = r.events.find((e) => e.type === 'feeReady');
  assert.equal(fee.kurz, true);
  assert.equal(fee.nights, 0);
  const night = sim.nightlyFee(s, ctx, b, fee.wishesMet.length);
  assert.ok(fee.amount < night, `Tagesliegegeld ${fee.amount} unter Nachtpreis ${night}`);
  assert.ok(b.leaveClock > s.clock && b.leaveClock <= rules.dayLength);
  const gaeste = s.guests;
  const geld = s.money;
  const ev = sim.tick(s, ctx, b.leaveClock - s.clock + 0.5);
  const dep = ev.find((e) => e.type === 'departed' && e.boatId === b.id);
  assert.ok(dep, 'legt ab');
  assert.equal(dep.kurz, true);
  assert.equal(dep.leaveAt, 0, 'sofort, nicht am nächsten Morgen');
  assert.equal(s.phase, 'day', 'noch derselbe Tag');
  assert.equal(s.guests, gaeste + 1);
  assert.equal(s.boats[b.id], undefined);
  assert.ok(s.money > geld, 'liegengebliebene Münze landet in der Kasse');
  assert.equal(sim.heute(s).kurzhalt, 1);
  // Box frei, sobald das Boot heraus ist
  sim.berthCleared(s, ctx, { boatId: b.id });
  assert.ok(sim.isFree(s, berth));
});

test('Kurzhalter, der abends einfährt, liegt nicht über Nacht', () => {
  const s = quietState(1);
  s.clock = rules.dayLength - 1;
  const b = waitingBoat(s, { stay: 0.5 });
  sim.tick(s, ctx, 2); // Abend beginnt
  assert.equal(s.phase, 'evening');
  // Kurzhalter an der Boje fahren abends weiter, ohne Bewertung und ohne als weggefahren zu zählen
  assert.equal(s.boats[b.id], undefined);
  assert.equal(s.stats.turnedAway, 0);
  // Von Hand abends noch hereingeholt: legt vor der Nacht wieder ab
  const c = waitingBoat(s, { stay: 0.5 });
  const berth = sim.fittingBerths(s, ctx, c.id)[0];
  assert.ok(sim.assign(s, ctx, c.id, berth).ok);
  assert.ok(c.leaveClock < rules.dayLength + rules.eveningLength);
  const ev = sim.tick(s, ctx, rules.eveningLength + 2);
  assert.ok(ev.some((e) => e.type === 'departed' && e.boatId === c.id && e.kurz));
  assert.ok(!Object.values(s.boats).some((x) => x.id === c.id));
});

test('Tagesrhythmus: Kurzhalter kommen im Mittel früher als Übernachter, ohne Wellen', () => {
  let kurz = 0, kurzN = 0, nacht = 0, nachtN = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = createState({ seed, rules });
    s.stage = 4;
    s.day = 3;
    s.ratings = Array(rules.reputation.window).fill(4);
    sim.tick(s, ctx, 0);
    for (const b of s.upcoming) {
      if (b.nights === 0) { kurz += b.arriveAt; kurzN++; } else { nacht += b.arriveAt; nachtN++; }
    }
  }
  assert.ok(kurzN > 0 && nachtN > 0);
  assert.ok(kurz / kurzN < nacht / nachtN, `Kurzhalt ${Math.round(kurz / kurzN)} s, Übernachter ${Math.round(nacht / nachtN)} s`);
  const anteil = kurzN / (kurzN + nachtN);
  assert.ok(anteil > 0.2 && anteil < 0.6, `Anteil Kurzhalt ${anteil}`);
});

test('Kurzhalter bleiben einen Tagesanteil aus economy.js, große Schiffe nie', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = createState({ seed, rules });
    s.stage = 6;
    s.day = 4;
    sim.tick(s, ctx, 0);
    for (const b of s.upcoming) {
      if (b.nights !== 0) continue;
      assert.ok(rules.shortStay.sizes.includes(b.size), `Größe ${b.size}`);
      assert.ok(b.stay >= rules.shortStay.stay[0] - 1e-9 && b.stay <= rules.shortStay.stay[1] + 1e-9);
    }
  }
});
