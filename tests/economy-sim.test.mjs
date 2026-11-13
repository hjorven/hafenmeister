// Spielregeln mit den Zahlen aus web/js/data/economy.js (Balancing-Thread)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, deserialize, serialize } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as sim from '../web/js/sim.js';

const rules = sim.rulesFromEconomy(ECONOMY);
const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });

test('Zahlen werden übernommen', () => {
  assert.equal(rules.baseFee.M, ECONOMY.klassen.M.grundpreis);
  assert.deepEqual(rules.nightsBySize.S, ECONOMY.klassen.S.naechte);
  assert.equal(rules.arrivalsPerDay[2], ECONOMY.stufen[1].ankuenfte);
  assert.equal(rules.stageGoals[1].cost, ECONOMY.stufen[0].ausbau.kosten);
  assert.equal(rules.facilities.wc.cost[1], ECONOMY.bauwerke.wc.stufen[0].kosten);
  assert.equal(rules.facilities.wc.levels[2], ECONOMY.bauwerke.wc.stufen[1].versorgt);
  assert.equal(rules.office.cost[1], ECONOMY.hafenbuero.stufen[0].kosten);
  assert.equal(rules.office.collectAllButton, 1);
  assert.equal(rules.office.autoCollect, 2);
  assert.equal(rules.office.autoAssign, 3);
  assert.equal(rules.trips.chance, ECONOMY.tagestoern.anteil);
  assert.deepEqual(rules.trips.back, ECONOMY.tagestoern.zurueck);
  assert.equal(rules.queue.selfEnterAfter, ECONOMY.warten.selbstEinfahrenNach);
  assert.ok(!rules.wishes[3].includes('diesel'));
  assert.ok(rules.wishes[4].includes('diesel'));
  assert.equal(rules.maxStage, ECONOMY.stufen.length);
});

test('Start: nur der alte Steg, Stegprojekt schaltet Plätze frei', () => {
  const s = createState({ seed: 1, rules });
  assert.deepEqual(sim.availableBerths(s, ctx).map((b) => b.id).sort(), ECONOMY.start.plaetze);
  const open = sim.openJettyProjects(s, ctx).map((p) => p.id);
  assert.deepEqual(open, ['a-haken']);
  assert.equal(sim.buildJettyProject(s, ctx, 'a-haken').reason, 'money');
  s.money = 1000;
  assert.equal(sim.buildJettyProject(s, ctx, 'a-haken').ok, true);
  assert.equal(sim.availableBerths(s, ctx).length, 6);
  assert.equal(sim.buildJettyProject(s, ctx, 'b-steg').reason, 'stage');
});

test('Ausbaustufe zählt Gäste je Stufe und schaltet die Plätze des Ausbaus frei, Fischer kommt von selbst', () => {
  const s = createState({ seed: 2, rules });
  s.money = 10000;
  s.stageGuests = ECONOMY.stufen[0].ziel.gaeste;
  s.guests = 999;
  const r = sim.advanceStage(s, ctx);
  assert.equal(r.ok, true);
  assert.equal(s.stage, 2);
  assert.equal(s.stageGuests, 0);
  assert.equal(s.buildings.dorfhafen, 1);
  assert.ok(sim.availableBerths(s, ctx).some((b) => b.id === 'F01'));
  assert.deepEqual(sim.canAdvanceStage(s, ctx).missing.includes('guests'), true);
  sim.runDay(s, ctx);
  const fisher = Object.values(s.boats).find((b) => b.stationed);
  assert.ok(fisher, 'Fischer liegt am Fischersteg');
  assert.equal(fisher.berthId, 'F01');
  const before = s.stats.totalIncome;
  sim.runDay(s, ctx);
  assert.ok(s.stats.totalIncome >= before + ECONOMY.fischer.pachtProTag);
});

test('Strom an Steg B erst mit Stromsäulen', () => {
  const s = createState({ seed: 3, rules });
  s.stage = 3;
  const b = ctx.berthById.B01;
  assert.equal(sim.berthHas(s, ctx, b, 'power'), false);
  assert.equal(sim.berthHas(s, ctx, ctx.berthById.C01, 'power'), true);
  s.money = 1e5;
  assert.equal(sim.upgradeFacility(s, ctx, 'strom').ok, true);
  assert.equal(sim.berthHas(s, ctx, b, 'power'), true);
});

test('S-Boote wünschen keinen Strom', () => {
  const s = createState({ seed: 4, rules });
  s.stage = 4;
  s.buildings = Object.fromEntries(Object.keys(rules.berthProjects).map((k) => [k, 1]));
  for (let i = 0; i < 300; i++) {
    const b = sim.rollBoat(s, ctx);
    if (b.size === 'S') assert.ok(!b.wishes.includes('strom'));
  }
});

test('Spieler baut alles Sinnvolle: kommt mit den Balancing-Zahlen voran', () => {
  const s = createState({ seed: 21, rules });
  for (let d = 0; d < 150; d++) {
    for (let t = 0; t < 120; t += 10) {
      sim.tick(s, ctx, 10);
      sim.autoAssign(s, ctx);
    }
    sim.collectAll(s, ctx, true);
    for (const p of sim.openJettyProjects(s, ctx)) sim.buildJettyProject(s, ctx, p.id);
    for (const k of Object.keys(rules.facilities)) sim.upgradeFacility(s, ctx, k);
    sim.upgradeOffice(s, ctx);
    sim.advanceStage(s, ctx);
    assert.ok(s.money >= 0);
  }
  assert.ok(s.stage >= 3, `Stufe ${s.stage} nach 150 Tagen`);
  assert.doesNotThrow(() => deserialize(serialize(s)));
});

test('Alter Spielstand ohne neue Felder wird ergänzt statt verworfen', () => {
  const s = createState({ seed: 5 });
  const old = JSON.parse(serialize(s));
  delete old.stageGuests;
  delete old.modules;
  const loaded = deserialize(JSON.stringify(old));
  assert.equal(loaded.stageGuests, 0);
  assert.deepEqual(loaded.modules, {});
});

test('Jedes kaufbare Stegprojekt bringt in der aktuellen Stufe Liegeplätze', async () => {
  const { ECONOMY: E } = await import('../web/js/data/economy.js');
  const { HAFEN: H } = await import('../web/js/data/harbor.js');
  const { BOAT_CATALOG: C } = await import('../web/js/data/boat-catalog.js');
  const S = await import('../web/js/sim.js');
  const { createState: cs } = await import('../web/js/state.js');
  const c = S.createContext({ boatTypes: C, harbor: H, rules: S.rulesFromEconomy(E) });
  // Jedes Projekt ist in mindestens einer Stufe kaufbar
  for (const p of c.rules.jettyProjects) {
    const stages = [1, 2, 3, 4, 5].filter((st) => st >= p.stage && S.projectHasBerths({ stage: st }, c, p.id));
    assert.ok(stages.length, `${p.id} hat in keiner Stufe Plätze`);
  }
  for (let st = 1; st <= 5; st++) {
    const s = cs({ seed: 1, rules: c.rules });
    s.stage = st;
    s.money = 1e7;
    for (const p of S.openJettyProjects(s, c)) {
      const before = S.availableBerths(s, c).length;
      assert.ok(S.buildJettyProject(s, c, p.id).ok, `${p.id} in Stufe ${st}`);
      assert.ok(S.availableBerths(s, c).length > before, `${p.id} bringt in Stufe ${st} keinen Platz`);
    }
  }
  // Der gemeldete Fall: Der T-Kopf an Steg B wird in Stufe 3 umgebaut. Das Projekt bringt dann
  // den neuen T-Kopf (Ersatzplätze), statt leer zu sein.
  const s3 = cs({ seed: 1, rules: c.rules });
  s3.stage = 3;
  s3.money = 1e7;
  assert.ok(S.openJettyProjects(s3, c).some((p) => p.id === 'b-tkopf'));
  assert.ok(S.buildJettyProject(s3, c, 'b-tkopf').ok);
  const ids = S.availableBerths(s3, c).map((b) => b.id);
  assert.ok(ids.includes('B27') && ids.includes('B28'));
});

test('Gekaufte Plätze bleiben beim Stufenwechsel erhalten (Umbau ersetzt sie)', async () => {
  const { ECONOMY: E } = await import('../web/js/data/economy.js');
  const { HAFEN: H } = await import('../web/js/data/harbor.js');
  const { BOAT_CATALOG: C } = await import('../web/js/data/boat-catalog.js');
  const S = await import('../web/js/sim.js');
  const { createState: cs } = await import('../web/js/state.js');
  const c = S.createContext({ boatTypes: C, harbor: H, rules: S.rulesFromEconomy(E) });
  for (const p of c.rules.jettyProjects) {
    const s = cs({ seed: 1, rules: c.rules });
    s.stage = p.stage;
    s.money = 1e7;
    if (!S.buildJettyProject(s, c, p.id).ok) continue;
    const mine = new Set(c.rules.berthProjects[p.id]);
    const count = () => S.availableBerths(s, c).filter((b) => mine.has(b.id)).length;
    const bought = count();
    for (let st = p.stage + 1; st <= 5; st++) {
      s.stage = st;
      assert.ok(count() >= bought, `${p.id}: in Stufe ${st} ${count()} statt ${bought} Plätze`);
    }
  }
});

test('Testmodus ?stufe=n: Spielstand der Stufe mit allen Plätzen, Geld und Ruf', () => {
  const zahl = {};
  for (let n = 1; n <= rules.maxStage; n++) {
    const s = sim.applyTestStage(createState({ seed: 1, rules }), ctx, n);
    assert.equal(s.stage, n);
    assert.equal(s.testmodus, true);
    zahl[n] = sim.availableBerths(s, ctx).length;
    assert.equal(sim.openJettyProjects(s, ctx).length, 0, `Stufe ${n}: alle Stegprojekte gebaut`);
    assert.ok(s.money >= 500);
    assert.equal(sim.reputation(s), 4);
    // Die Regeln laufen in dieser Stufe: ein Tag ohne Fehler, Boote kommen
    const ev = sim.runDay(s, ctx);
    assert.ok(ev.some((e) => e.type === 'arrived'), `Stufe ${n}: es kommen Boote`);
  }
  assert.ok(zahl[2] > zahl[1] && zahl[5] > zahl[3]);
  assert.equal(sim.applyTestStage(createState({ seed: 1, rules }), ctx, 99).stage, rules.maxStage);
});

test('Stufenwechsel mit vollem Hafen: nach jedem Ausbau liegt kein Boot auf einem Platz, den es nicht gibt', () => {
  const c = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  c.rules.queue.selfEnterAfter = null;
  for (let n = 1; n < c.rules.maxStage; n++) {
    if (!c.rules.stageGoals[n]) continue;
    const s = sim.applyTestStage(createState({ seed: n, rules: c.rules }), c, n);
    sim.tick(s, c, 0);
    // jede freie Gastbox mit einem kleinen Boot belegen
    let id = 5000;
    for (const b of sim.availableBerths(s, c)) {
      if (!sim.isFree(s, b.id) || b.reserved) continue;
      const boat = { id: ++id, typeId: 'S1', modelId: null, name: 'Gast', size: b.sizes?.[0] ?? 'S', length: 3, beam: 1.2, draft: 0.2, motor: false,
        special: false, dayVisitors: 0, stationed: false, wishes: [], nights: 3, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
        berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0 };
      s.boats[boat.id] = boat;
      s.queue.push(boat.id);
      assert.ok(sim.assign(s, c, boat.id, b.id).ok, `${b.id} in Stufe ${n}`);
    }
    const vorschau = sim.stageUpPreview(s, c);
    const vorher = sim.mooredBoats(s).length;
    s.money = 1e7; s.stageGuests = 1e5; s.guests = 1e5; s.ratings = Array(20).fill(5);
    const r = sim.advanceStage(s, c);
    assert.ok(r.ok, `Ausbau ${n} nach ${n + 1}`);
    for (const [platz, bootId] of Object.entries(s.berths)) {
      assert.ok(c.berthById[platz].stages.includes(s.stage), `${platz} gibt es in Stufe ${s.stage} nicht`);
      assert.equal(s.boats[bootId].berthId, platz);
    }
    for (const b of sim.mooredBoats(s)) assert.equal(s.berths[b.berthId], b.id);
    const weg = r.events.filter((e) => e.type === 'departed' && e.reason === 'rebuild').length;
    assert.equal(weg, vorschau.guests.length, `Stufe ${n}: Vorschau stimmt`);
    assert.equal(sim.mooredBoats(s).length, vorher - weg - r.events.filter((e) => e.type === 'unstationed').length);
    sim.runDay(s, c); // läuft danach normal weiter
  }
});

test('Stufenwechsel: Gast in einer Box, die flacher wird, legt in eine passende freie Box um', () => {
  const c = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  c.rules.queue.selfEnterAfter = null;
  const s = sim.applyTestStage(createState({ seed: 3, rules: c.rules }), c, 2);
  sim.tick(s, c, 0);
  // B03 ist in Stufe 2 1,5 m tief, in Stufe 3 nur noch 1,4 m
  const b03 = c.berthById.B03;
  assert.ok(sim.berthDepth(b03, 2) > sim.berthDepth(b03, 3));
  const gast = (id, draft) => ({ id, typeId: 'M1', modelId: null, name: 'Gast', size: 'M', length: 8, beam: 2.8, draft, motor: false,
    special: false, dayVisitors: 0, stationed: false, wishes: [], nights: 3, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
    berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0 });
  const tief = sim.berthDepth(b03, 2) - c.rules.underKeelClearance;
  const boot = gast(7001, Math.round((tief - 0.02) * 100) / 100);
  s.boats[boot.id] = boot; s.queue.push(boot.id);
  assert.ok(sim.assign(s, c, boot.id, 'B03').ok, 'passt in Stufe 2');
  assert.equal(sim.fits(boot, b03, c.rules, 3), false, 'passt in Stufe 3 nicht mehr');
  assert.deepEqual(sim.stageUpPreview(s, c).moving, [7001]);
  s.money = 1e7; s.stageGuests = 1e5; s.guests = 1e5; s.ratings = Array(20).fill(5);
  const r = sim.advanceStage(s, c);
  assert.ok(r.ok);
  const um = r.events.find((e) => e.type === 'relocated' && e.boatId === 7001);
  assert.ok(um && um.guest && um.from === 'B03', 'Gast wird umgelegt');
  assert.equal(s.berths.B03, undefined);
  assert.equal(s.berths[um.to], 7001);
  assert.equal(s.boats[7001].nights, 3, 'Aufenthalt bleibt');
  for (const b of sim.mooredBoats(s)) {
    if (!b.stationed) assert.ok(sim.fits(b, c.berthById[b.berthId], c.rules, s.stage), `${b.id} passt in ${b.berthId}`);
  }
});

test('Stufenwechsel: Stufe 3 hat weniger Bojen als Stufe 2, niemand wartet an einer Boje, die es nicht gibt', () => {
  const c = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  c.rules.queue.selfEnterAfter = null;
  const spots = c.rules.queue.spots;
  assert.ok(spots[2] > spots[3], 'Voraussetzung: Stufe 3 hat weniger Bojen');
  const warte = (s, id, spot) => {
    s.boats[id] = { id, typeId: 'XX', modelId: null, name: 'Wartet', size: 'XXL', length: 90, beam: 20, draft: 9, motor: true, special: false,
      dayVisitors: 0, stationed: false, wishes: [], nights: 1, status: 'waiting', waitSpot: spot, waitingSince: 0, atBuoy: true, atBuoySince: 0,
      berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0 };
    s.queue.push(id);
  };
  const stufeHoch = (s) => {
    s.money = 1e7; s.stageGuests = 1e5; s.guests = 1e5; s.ratings = Array(20).fill(5);
    const r = sim.advanceStage(s, c);
    assert.ok(r.ok);
    return r.events;
  };
  // 1. nur die letzte Boje belegt: Boot verholt an die kleinste freie
  let s = sim.applyTestStage(createState({ seed: 4, rules: c.rules }), c, 2);
  sim.tick(s, c, 0);
  warte(s, 8001, spots[2] - 1);
  let ev = stufeHoch(s);
  assert.deepEqual(ev.find((e) => e.type === 'waitSpotChanged'), { type: 'waitSpotChanged', boatId: 8001, from: spots[2] - 1, waitSpot: 0 });
  assert.equal(s.boats[8001].waitSpot, 0);
  // 2. alle Bojen belegt: das überzählige Boot fährt ohne Bewertung weiter, die anderen bleiben
  s = sim.applyTestStage(createState({ seed: 5, rules: c.rules }), c, 2);
  sim.tick(s, c, 0);
  for (let i = 0; i < spots[2]; i++) warte(s, 8100 + i, i);
  const ruf = [...s.ratings];
  ev = stufeHoch(s);
  const weg = ev.filter((e) => e.type === 'turnedAway');
  assert.equal(weg.length, spots[2] - spots[3]);
  assert.ok(weg.every((e) => e.reason === 'rebuild' && e.rated === false));
  const wartend = sim.waitingBoats(s);
  assert.equal(wartend.length, spots[3]);
  assert.equal(new Set(wartend.map((b) => b.waitSpot)).size, spots[3]);
  assert.ok(wartend.every((b) => b.waitSpot < spots[3]));
});
