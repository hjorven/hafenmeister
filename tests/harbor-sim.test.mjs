// Spielregeln mit den echten Daten: Liegeplätze aus data/harbor.js, Bootsarten aus dem Ersatzkatalog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize } from '../web/js/state.js';
import { RULES } from '../web/js/data/rules.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as sim from '../web/js/sim.js';
import { initBridge, typesFromModule, mergeTypes } from '../web/js/bridge.js';

const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });

test('Liegeplätze je Stufe wie im Katalog: 6, 30, 54, 76, 94', () => {
  const s = createState({ seed: 1 });
  const counts = [1, 2, 3, 4, 5].map((st) => {
    s.stage = st;
    return sim.availableBerths(s, ctx).length;
  });
  assert.deepEqual(counts, [6, 30, 54, 76, 94]);
});

test('Platzarten: Strom, Komfort, Kai nur XL, Fischerplätze gesperrt', () => {
  const byKind = (k) => ctx.berths.find((b) => b.kind === k);
  assert.equal(byKind('finger').power, true);
  assert.equal(byKind('finger').comfort, 1);
  assert.deepEqual(byKind('kai').sizes, ['XL']);
  assert.equal(byKind('kai').exposed, true);
  assert.equal(byKind('fischer').reserved, true);
  assert.equal(ctx.berths.find((b) => b.jetty === 'A').power, false);
  assert.equal(ctx.berths.find((b) => b.jetty === 'C').power, true);
});

test('Wassertiefe hängt an der Stufe', () => {
  const b = ctx.berths.find((x) => Object.keys(x.depth).length > 1);
  const stages = Object.keys(b.depth).map(Number);
  for (const st of stages) assert.equal(sim.berthDepth(b, st), b.depth[st]);
  assert.equal(sim.berthDepth(b, Math.max(...stages) + 1), b.depth[Math.max(...stages)]);
  assert.equal(sim.berthDepth({ depth: 2 }, 3), 2);
});

test('Stufe 1: nur Boote, die in den flachen See passen', () => {
  const s = createState({ seed: 8 });
  const types = sim.eligibleTypes(s, ctx).map((t) => t.id).sort();
  assert.deepEqual(types, ['S1', 'S2', 'S3']);
});

test('Jede Stufe: alle angebotenen Bootsarten passen an mindestens einen Platz', () => {
  for (let st = 1; st <= 5; st++) {
    const s = createState({ seed: st });
    s.stage = st;
    for (let i = 0; i < 200; i++) {
      const b = sim.rollBoat(s, ctx);
      assert.ok(sim.couldEverFit(s, ctx, b), `Stufe ${st}: ${b.typeId} ${b.length}x${b.beam}x${b.draft}`);
    }
  }
});

test('Mehrere Spieljahre mit echten Daten: Fortschritt und stimmige Zahlen', () => {
  const s = createState({ seed: 11 });
  s.office = 3;
  for (let d = 0; d < 200; d++) {
    sim.runDay(s, ctx);
    sim.collectAll(s, ctx, true);
    for (const k of Object.keys(RULES.facilities)) sim.upgradeFacility(s, ctx, k);
    sim.advanceStage(s, ctx);
    assert.ok(s.money >= 0);
    for (const [berthId, boatId] of Object.entries(s.berths)) assert.equal(s.boats[boatId].berthId, berthId);
  }
  assert.ok(s.stage >= 3, `Stufe ${s.stage}`);
  assert.ok(Object.keys(s.logbook).length >= 5);
  assert.doesNotThrow(() => JSON.parse(serialize(s)));
});

test('Datenmodule der Schiffs-Threads werden erkannt und gemischt', () => {
  const mod = { default: { arten: [{ id: 'S1', groesse: 'S', name: 'Ruderboot neu', modelle: [{ id: 'S1-1' }] }] }, irgendwas: 3 };
  const found = typesFromModule(mod);
  assert.equal(found.length, 1);
  const merged = mergeTypes(BOAT_CATALOG, found);
  const s1 = merged.find((t) => t.id === 'S1');
  assert.equal(s1.name, 'Ruderboot neu');
  assert.deepEqual(s1.length, [3, 4.5]); // aus dem Katalog
  const c = sim.createContext({ boatTypes: merged, harbor: HAFEN });
  assert.equal(c.typeById.S1.models[0].id, 'S1-1');
  assert.equal(merged.length, BOAT_CATALOG.length);
  const named = typesFromModule({ S2: { id: 'S2', klasse: 'S', laenge: [2, 3], breite: 1, tiefgang: 0.1, antrieb: 'motor' } });
  const t = sim.createContext({ boatTypes: named }).typeById.S2;
  assert.deepEqual(t.length, [2, 3]);
  assert.equal(t.motor, true);
});

function fakeGame() {
  const listeners = new Map();
  const tickers = [];
  const emitted = [];
  return {
    emitted,
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    },
    emit(name, data) {
      emitted.push([name, data]);
      for (const fn of listeners.get(name) || []) fn(data);
    },
    onTick(fn) { tickers.push(fn); },
    tick(dt) { for (const fn of tickers) fn(dt, this); },
  };
}

test('Echte M-Daten des Schiffs-Threads (TYPES und MODELS) werden übernommen', async () => {
  const mod = await import('../web/js/data/boats/m.js');
  const found = typesFromModule(mod);
  assert.deepEqual(found.map((t) => t.size), ['M', 'M', 'M', 'M']);
  const c = sim.createContext({ boatTypes: mergeTypes(BOAT_CATALOG, found), harbor: HAFEN });
  assert.ok(c.typeById.M1.models.length >= 2);
  assert.equal(c.typeById.M1.minStage, 2);
  assert.equal(c.typeById.M4.stationed, true); // aus dem Katalog
  const s = createState({ seed: 3 });
  s.stage = 2;
  const boats = Array.from({ length: 100 }, () => sim.rollBoat(s, c)).filter((b) => b.size === 'M');
  assert.ok(boats.length > 10);
  assert.ok(boats.every((b) => b.modelId && sim.couldEverFit(s, c, b)));
});

test('Anbindung an game: Zustand, deutsche Namen, Ereignisse, Gesten', async () => {
  const game = fakeGame();
  const saved = [];
  game.spielstand = { laden: () => null, speichern: (st) => saved.push(st.day) };
  await initBridge(game);
  assert.equal(game.state.stufe, 1);
  assert.equal(game.state.region, 'ostsee');
  game.state.geld = 50;
  assert.equal(game.state.money, 50);
  assert.ok(!Object.keys(JSON.parse(JSON.stringify(game.state))).includes('stufe'));
  assert.ok(game.emitted.some(([n, d]) => n === 'stufe' && d === 1));
  assert.ok(game.emitted.some(([n, d]) => n === 'phase' && d === 'tag'));

  // Bis ein Boot wartet
  for (let i = 0; i < 90 && !game.sim.waitingBoats().length; i++) game.tick(1);
  const boat = game.sim.waitingBoats()[0];
  assert.ok(boat, 'ein Boot wartet');
  assert.equal(game.sim.wartet(boat.id), true);
  const places = game.sim.passendePlaetze(`b${boat.id}`);
  assert.ok(places.length > 0);
  game.emit('ui:tow-end', { boot: boat.id, platz: places[0] });
  assert.equal(game.state.boats[boat.id].berthId, places[0]);
  assert.ok(game.emitted.some(([n, d]) => n === 'boot-kommt' && d.id === boat.id && d.boje === 0));
  assert.ok(game.emitted.some(([n, d]) => n === 'boot:angelegt' && d.platz === places[0] && d.zustand === 'liegt'));
  assert.ok(game.sim.boote.some((b) => b.id === boat.id && b.platz === places[0]));
  assert.ok(game.sim.tagesAnteil() > 0 && game.sim.tagesAnteil() < 1);
  assert.ok(game.emitted.some(([n]) => n === 'sim:moored'));

  // Abend: Münzen einstreichen
  game.sim.fastForward(1000);
  assert.equal(game.state.phase, 'evening');
  assert.ok(game.emitted.some(([n, d]) => n === 'phase' && d === 'abend'));
  assert.ok(game.emitted.some(([n, d]) => n === 'tag:ende' && d.boote.length >= 1));
  const before = game.state.money;
  game.emit('ui:collect', { coin: boat.id, combo: 1 });
  assert.ok(game.state.money > before);
  // Services-Abrechnung
  game.emit('services:abrechnung', { summe: 12 });
  assert.equal(game.state.money > before + 12 - 1, true);
  // Nacht: speichern und neuer Tag
  game.sim.fastForward(1000);
  assert.equal(game.state.day, 2);
  assert.deepEqual(saved, [2]); // gespeichert wird der neue Morgen
  assert.ok(game.emitted.some(([n, d]) => n === 'day:start' && d.day === 2));

  // Neuer Spielstand von außen
  const next = createState({ seed: 5 });
  next.stage = 3;
  game.emit('spielstand-geladen', next);
  assert.equal(game.state.stufe, 3);
});

test('Anbindung: Modifikatoren aus game.events und game.services', async () => {
  const game = fakeGame();
  await initBridge(game);
  game.events = { modifiers: () => ({ arrivalFactor: 2 }) };
  game.services = { effekte: () => ({ priceFactor: 1.5 }) };
  const m = game.sim.modifiers();
  assert.equal(m.arrivalFactor, 2);
  assert.equal(m.priceFactor, 1.5);
});

test('Abschlussziel: Kreuzfahrt und Flottenbesuch zählen, Windjammer und Ausflug nicht', async () => {
  const game = fakeGame();
  await initBridge(game);
  game.state.stage = game.sim.ctx.rules.maxStage;
  for (const art of ['kreuzfahrt', 'flottenbesuch', 'flottenbesuch', 'windjammer', 'ausflugsfahrt']) {
    game.emit('services:besuch', { id: 'x', art, tag: 1, dauer: 1 });
  }
  assert.equal(game.state.bigVisits, 3);
  assert.equal(sim.regionGoal(game.state, game.sim.ctx).visits, 3);
});
