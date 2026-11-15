// Liegende Boote umlegen (P33, F4): Regeln ohne Browser, mit den echten Zahlen aus economy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { haengeEin, machDauerplatz, dauerState, neuerBewerber, kannDauerplatz, umlege, wartetAuf } from '../web/js/features/dauerlieger.js';
import { gruendeAusAbreise, erklaerung } from '../web/js/ui/gaestebuch-daten.js';

function neu({ seed = 3, stufe = 2, dauer = false } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  ctx.rules.queue.selfEnterAfter = null;
  ctx.rules.queue.buoyFee = 0;
  if (dauer) haengeEin((name, fn) => sim.addHook(ctx, name, fn));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  state.testmodus = false;
  sim.tick(state, ctx, 0);
  state.upcoming = [];
  return { ctx, state };
}

let naechste = 5000;
function gast(state, ctx, platz, extra = {}) {
  const id = naechste++;
  const b = { id, typeId: 'S1', modelId: null, name: 'Gast', size: 'S', length: 4, beam: 1.4, draft: 0.2, motor: false, special: false,
    dayVisitors: 0, stationed: false, wishes: [], nights: 3, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
    berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...extra };
  state.boats[id] = b;
  state.queue.push(id);
  const r = sim.assign(state, ctx, id, platz);
  assert.ok(r.ok, `Gast passt an ${platz}: ${r.reason}`);
  return b;
}
const freieS = (state, ctx) => sim.availableBerths(state, ctx)
  .filter((b) => sim.isFree(state, b.id) && !b.reserved && sim.fits({ length: 4, beam: 1.4, draft: 0.2, size: 'S' }, b, ctx.rules, state.stage))
  .map((b) => b.id);

test('Umlegen: Gast zieht in eine freie Box, Liegegeld und Nächte bleiben', () => {
  const { ctx, state } = neu();
  const [a, b] = freieS(state, ctx);
  const g = gast(state, ctx, a);
  const offen = g.pendingFee;
  assert.ok(offen > 0, 'Liegegeld ist fällig');
  const geld = state.money;
  assert.ok(sim.canRelocate(state, g.id));
  assert.ok(sim.relocateTargets(state, ctx, g.id).includes(b));
  assert.ok(!sim.relocateTargets(state, ctx, g.id).includes(a), 'eigene Box ist kein Ziel');
  const r = sim.relocateGuest(state, ctx, g.id, b);
  assert.ok(r.ok);
  assert.equal(state.berths[a], undefined);
  assert.equal(state.berths[b], g.id);
  assert.equal(g.berthId, b);
  assert.equal(g.status, 'moored');
  assert.equal(g.pendingFee, offen, 'offenes Liegegeld bleibt offen');
  assert.equal(state.money, geld, 'kein Geld hin oder her');
  assert.equal(g.nights, 3);
  assert.equal(g.umgelegt, 1);
  assert.deepEqual(r.events.map((e) => e.type), ['relocated']);
  assert.equal(r.events[0].grund, 'hand');
  assert.equal(r.events[0].malus, undefined, 'das erste Mal kostet nichts');
  // Bezahltes bleibt bezahlt
  sim.collect(state, ctx, g.id);
  const bezahlt = state.money;
  const [c] = freieS(state, ctx);
  assert.ok(sim.relocateGuest(state, ctx, g.id, c).ok);
  assert.equal(state.money, bezahlt);
  assert.equal(g.pendingFee, 0);
  assert.notEqual(g.paid, false);
});

test('Umlegen: ab dem zweiten Mal sinkt die Bewertung der Crew', () => {
  const { ctx, state } = neu();
  const [a, b, c, d] = freieS(state, ctx);
  const g = gast(state, ctx, a);
  const note0 = sim.ratingParts(ctx, g).value;
  sim.relocateGuest(state, ctx, g.id, b);
  assert.equal(sim.ratingParts(ctx, g).value, note0, 'einmal umlegen nimmt die Crew hin');
  const r2 = sim.relocateGuest(state, ctx, g.id, c);
  const malus = ECONOMY.umlegen.ruf;
  assert.equal(r2.events[0].malus, malus);
  assert.equal(r2.events[0].mal, 2);
  const p = sim.ratingParts(ctx, g);
  assert.equal(p.moved, malus);
  assert.equal(p.value, Math.round((note0 - malus) * 10) / 10);
  sim.relocateGuest(state, ctx, g.id, d);
  assert.equal(sim.ratingParts(ctx, g).moved, 2 * malus);
  // Gästebuch nennt den Grund
  const { gruende } = gruendeAusAbreise({ type: 'departed', parts: sim.ratingParts(ctx, g) });
  assert.ok(gruende.some((x) => x.key === 'umgelegt'));
  assert.match(erklaerung({ gruende, plus: [] }), /zu oft umgelegt −1/);
});

test('Umlegen: Platzwert zeigt die Folgen vor dem Loslassen', () => {
  const { ctx, state } = neu();
  const [a, b, c] = freieS(state, ctx);
  const g = gast(state, ctx, a);
  const w1 = sim.berthValue(state, ctx, g.id, b);
  assert.equal(w1.relocate, true);
  assert.equal(w1.malus, 0);
  sim.relocateGuest(state, ctx, g.id, b);
  const w2 = sim.berthValue(state, ctx, g.id, c);
  assert.equal(w2.malus, ECONOMY.umlegen.ruf);
  assert.equal(w2.mal, 2);
});

test('Umlegen geht nicht: belegt, zu klein, gleiche Box, wartend, fest, auf Törn', () => {
  const { ctx, state } = neu();
  const [a, b, c] = freieS(state, ctx);
  const g = gast(state, ctx, a);
  const h = gast(state, ctx, b);
  assert.equal(sim.relocateGuest(state, ctx, g.id, b).reason, 'occupied');
  assert.equal(sim.relocateGuest(state, ctx, g.id, a).reason, 'same');
  assert.equal(sim.relocateGuest(state, ctx, g.id, 'gibtsnicht').reason, 'noBerth');
  // zu großes Boot für eine kleine Box
  g.length = 30;
  assert.ok(sim.relocateGuest(state, ctx, g.id, c).reason);
  g.length = 4;
  // auf Tagestörn: nicht greifbar
  h.trip = { away: true };
  assert.equal(sim.canRelocate(state, h.id), false);
  assert.equal(sim.relocateGuest(state, ctx, h.id, c).reason, 'away');
  assert.deepEqual(sim.relocateTargets(state, ctx, h.id), []);
  // fest liegende Boote und wartende Boote nicht
  h.trip = null; h.stationed = true;
  assert.equal(sim.relocateGuest(state, ctx, h.id, c).reason, 'stationed');
  const w = { ...g, id: 7777, status: 'waiting', berthId: null };
  state.boats[w.id] = w;
  assert.equal(sim.canRelocate(state, w.id), false);
  assert.equal(sim.relocateGuest(state, ctx, w.id, c).reason, 'notMoored');
  assert.equal(g.umgelegt, undefined, 'fehlgeschlagene Versuche zählen nicht');
});

test('Umlegen: Strom-Wunsch gilt ab dem nächsten Morgen für die neue Box', () => {
  const { ctx, state } = neu({ stufe: 3 });
  const probe = { length: 4, beam: 1.4, draft: 0.2, size: 'S' };
  const frei = sim.availableBerths(state, ctx).filter((b) => sim.isFree(state, b.id) && !b.reserved && sim.fits(probe, b, ctx.rules, state.stage));
  const mit = frei.find((b) => sim.berthHas(state, ctx, b, 'power'));
  const ohne = frei.find((b) => !sim.berthHas(state, ctx, b, 'power'));
  assert.ok(mit && ohne, 'Stufe 3 hat Boxen mit und ohne Strom');
  const g = gast(state, ctx, ohne.id, { wishes: ['strom'], nights: 3 });
  assert.equal(g.wishesMet, 0);
  assert.ok(sim.relocateGuest(state, ctx, g.id, mit.id).ok);
  sim.runDay(state, ctx);
  assert.ok(g.wishesMet > 0, 'am Morgen in der neuen Box: Strom da');
});

test('Ausbau: Gast auf wegfallendem Platz legt um, wenn eine Box frei ist, sonst reist er ab', () => {
  const { ctx, state } = neu({ stufe: 2 });
  // B17 gibt es ab Stufe 3 nicht mehr
  assert.ok(!ctx.berthById.B17.stages.includes(3));
  const g = gast(state, ctx, 'B17');
  const offen = g.pendingFee;
  const vorschau = sim.stageUpPreview(state, ctx);
  assert.ok(vorschau.moving.includes(g.id), 'Vorschau: legt um');
  assert.ok(!vorschau.guests.includes(g.id));
  assert.equal(state.berths.B17, g.id, 'Vorschau ändert nichts');
  state.money = 1e7; state.stageGuests = 1e5; state.guests = 1e5; state.ratings = Array(20).fill(5);
  const gaeste = state.guests;
  const r = sim.advanceStage(state, ctx);
  assert.ok(r.ok);
  const um = r.events.find((e) => e.type === 'relocated' && e.boatId === g.id);
  assert.ok(um, 'Gast legt um');
  assert.equal(um.grund, 'umbau');
  assert.equal(um.from, 'B17');
  assert.equal(state.berths[um.to], g.id);
  assert.ok(ctx.berthById[um.to].stages.includes(3));
  assert.equal(g.pendingFee, offen, 'Rechnung bleibt');
  assert.equal(state.guests, gaeste, 'reist nicht ab, zählt also noch nicht');
  assert.equal(g.umgelegt, 1);
});

test('Ausbau: Vorschau und Ausbau stimmen bei vollem Hafen überein', () => {
  let umAlle = 0, wegAlle = 0;
  for (const n of [2, 3, 4, 5]) {
    const { ctx, state } = neu({ stufe: n, seed: 10 + n });
    // jede freie Box mit einem passenden kleinen Gast belegen, bis auf zwei (Stufe 2: alle)
    const frei = freieS(state, ctx);
    for (const id of frei.slice(0, Math.max(0, frei.length - (n === 2 ? 0 : 2)))) gast(state, ctx, id);
    const v = sim.stageUpPreview(state, ctx);
    state.money = 1e7; state.stageGuests = 1e5; state.guests = 1e5; state.ratings = Array(20).fill(5);
    const r = sim.advanceStage(state, ctx);
    assert.ok(r.ok);
    const weg = r.events.filter((e) => e.type === 'departed' && e.reason === 'rebuild').map((e) => e.boatId).sort();
    const um = r.events.filter((e) => e.type === 'relocated' && e.guest).map((e) => e.boatId).sort();
    assert.deepEqual(weg, [...v.guests].sort(), `Stufe ${n}: Abreisen wie angekündigt`);
    assert.deepEqual(um, [...v.moving].sort(), `Stufe ${n}: Umlegen wie angekündigt`);
    for (const [platz, id] of Object.entries(state.berths)) assert.equal(state.boats[id].berthId, platz);
    umAlle += um.length; wegAlle += weg.length;
  }
  assert.ok(umAlle > 0, `es wird umgelegt (${umAlle}, abgereist ${wegAlle})`);
});

test('Ausbau ohne freie passende Box: Gast reist ab wie bisher, Vorschau sagt es', () => {
  const { ctx, state } = neu({ stufe: 2 });
  const g = gast(state, ctx, 'B17');
  // Alle Boxen der nächsten Stufe belegt (neue gleich mit): nichts frei zum Umlegen
  let id = 90000;
  for (const b of ctx.berths) {
    if (!b.stages?.includes(3) || state.berths[b.id] != null) continue;
    state.boats[id] = { id, typeId: 'S1', size: 'S', length: 4, beam: 1.4, draft: 0.2, stationed: true, status: 'moored', berthId: b.id, wishes: [], penalty: 0 };
    state.berths[b.id] = id++;
  }
  const v = sim.stageUpPreview(state, ctx);
  assert.ok(v.guests.includes(g.id));
  assert.ok(!v.moving.includes(g.id));
  state.money = 1e7; state.stageGuests = 1e5; state.guests = 1e5; state.ratings = Array(20).fill(5);
  const r = sim.advanceStage(state, ctx);
  const dep = r.events.find((e) => e.type === 'departed' && e.boatId === g.id);
  assert.ok(dep && dep.reason === 'rebuild' && dep.leaveAt === 0);
  assert.equal(state.boats[g.id], undefined);
});

test('Dauerlieger-Rücktausch: Ziehen des Gastes lässt den wartenden Dauerlieger einlaufen', () => {
  const { ctx, state } = neu({ seed: 6, dauer: true });
  ctx.rules.dauer = { ...ctx.rules.dauer, toernChance: 0, tagestoernChance: 0 };
  sim.tick(state, ctx, 1);
  for (let i = 0; i < 6 && !sim.availableBerths(state, ctx).some((b) => kannDauerplatz(state, ctx, b.id).ok); i++) neuerBewerber(state, ctx);
  const platz = sim.availableBerths(state, ctx).find((b) => kannDauerplatz(state, ctx, b.id).ok).id;
  const { boatId } = machDauerplatz(state, ctx, platz);
  // Dauerlieger ist auf Törn und kommt heute Nachmittag früher zurück
  const p = dauerState(state).plaetze[platz];
  const boot = state.boats[p.bootId];
  delete state.berths[platz]; delete state.boats[boot.id];
  boot.status = 'away';
  Object.assign(p, { boot, rueckNacht: state.day, frueherUm: 0.5 });
  // Gast auf dem Dauerplatz
  const id = state.nextId++;
  state.boats[id] = { id, typeId: 'S1', size: 'S', kind: 'motor', length: 4, beam: 1.4, draft: 0.2, stationed: false, nights: 1,
    wishes: [], status: 'waiting', penalty: 0, wishesMet: 0, wishesTotal: 0, pendingFee: 0 };
  state.queue.push(id);
  state.leaving = { [platz]: { boatId: 998, elapsed: 0, at: 30, off: false } };
  delete state.leaving[platz];
  assert.ok(sim.assign(state, ctx, id, platz).ok);
  sim.tick(state, ctx, ctx.rules.dayLength * 0.5 + 1);
  assert.equal(wartetAuf(state, id), platz, 'Dauerlieger wartet');
  const ziel = sim.relocateTargets(state, ctx, id)[0];
  assert.ok(ziel);
  // wie bridge.js beim Loslassen der Leine
  const r = sim.relocateGuest(state, ctx, id, ziel, { grund: 'hand' });
  assert.ok(r.ok);
  const typen = r.events.map((e) => e.type);
  assert.deepEqual(typen, ['relocated', 'dauerUmgelegt', 'dauerEinlaufen']);
  assert.equal(state.berths[platz], boatId, 'Dauerlieger liegt wieder');
  assert.equal(state.berths[ziel], id);
  assert.equal(state.boats[id].umgelegt, 1);
  assert.equal(dauerState(state).plaetze[platz].wartet, false);
  // Über die Karte (umlege) zählt es genauso
  const { ctx: c2, state: s2 } = { ctx, state };
  assert.equal(umlege(s2, c2, id, ziel).ok, false, 'kein Grund mehr');
});
