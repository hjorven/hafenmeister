// Ereignisse zum Vorbereiten (P24): Sturm sturmklar machen, Plätze für die Regatta freihalten,
// Ergebnis am Abend. Logik ohne Browser, mit den echten Zahlen aus economy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as V from '../web/js/events/vorbereiten.js';

function neu({ seed = 5, stufe = 3, plan = {} } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const p = { laufend: null, geplant: null, outer: 0, ...plan };
  V.haengeEin((name, fn) => sim.addHook(ctx, name, fn), { laufend: () => p.laufend, geplant: () => p.geplant, outer: () => p.outer });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  // Ohne zufällige Ankünfte und Törns, damit nur die Boote aus dem Test liegen
  for (const b of Object.values(state.boats)) if (!b.stationed) { if (state.berths[b.berthId] === b.id) delete state.berths[b.berthId]; delete state.boats[b.id]; }
  state.queue = [];
  state.upcoming = [];   // keine Ankünfte aus dem Testmodus
  return { ctx, state, p };
}

/** Gast einer Bootsart auf einen Platz legen (wie nach dem Zuweisen). */
function gastAuf(state, ctx, platz, typeId = 'S1', nights = 2) {
  const t = ctx.typeById[typeId];
  const id = state.nextId++;
  state.boats[id] = {
    id, typeId, size: t.size, kind: t.kind, length: t.length[0], beam: t.beam[0], draft: t.draft[0],
    stationed: false, nights, wishes: [], status: 'waiting', penalty: 0,
  };
  state.queue.push(id);
  const r = sim.assign(state, ctx, id, platz);
  assert.ok(r.ok, `Gast passt nicht auf ${platz}: ${r.reason}`);
  return id;
}

const offenePlaetze = (state, ctx) => sim.availableBerths(state, ctx).filter((b) => b.exposed && sim.isFree(state, b.id));

test('Stirnplätze liegen offen zur See, ab Stufe 3 gibt es sie', () => {
  const { ctx, state } = neu();
  assert.equal(ECONOMY.platzarten.stirn.offen, true);
  assert.ok(offenePlaetze(state, ctx).length >= 2, 'Stufe 3 hat offene Stirnplätze');
  assert.ok(sim.availableBerths(state, ctx).filter((b) => b.exposed).every((b) => ['stirn', 'kai'].includes(b.kind)));
});

test('Sturmklar: Gäste von offenen Plätzen nach innen, offene Plätze gesperrt', () => {
  const { ctx, state } = neu();
  const plan = { id: 'sturm', startDay: state.day + 1, endDay: state.day + 1 };
  const [a, b] = offenePlaetze(state, ctx);
  const g1 = gastAuf(state, ctx, a.id);
  const g2 = gastAuf(state, ctx, b.id);
  assert.equal(V.draussen(state, ctx).length, 2);
  const r = V.sturmklar(state, ctx, plan);
  assert.ok(r.ok);
  assert.equal(r.verholt, 2);
  assert.equal(V.draussen(state, ctx).length, 0);
  for (const id of [g1, g2]) {
    const boat = state.boats[id];
    assert.ok(!ctx.berthById[boat.berthId].exposed, 'liegt jetzt innen');
    assert.equal(state.berths[boat.berthId], id);
  }
  assert.ok(!state.berths[a.id] && !state.berths[b.id], 'alte Plätze sind frei');
  // Umzug als 'relocated' (die 3D-Ansicht fährt das Boot hinüber)
  assert.equal(r.events.filter((e) => e.type === 'relocated').length, 2);
  // Gesperrt: kein Gast passt an einen offenen Platz, das Schild zeigt 'reserviert'
  assert.equal(sim.berthState(state, ctx, a.id), 'reserviert');
  const probe = { id: 999, typeId: 'S1', size: 'S', length: 4, beam: 1.8, draft: 0.4, stationed: false, wishes: [], nights: 1 };
  assert.equal(sim.hookWhyNotFit(state, ctx, probe, a), 'sturm');
  // Fest liegende Boote (Retter, Dauerlieger) betrifft die Sperre nicht
  assert.equal(sim.hookWhyNotFit(state, ctx, { ...probe, stationed: true }, a), null);
});

test('Sturmklar ohne Platz innen: Gast bleibt draußen und wird gezählt', () => {
  const { ctx, state } = neu();
  const plan = { id: 'sturm', startDay: state.day + 1, endDay: state.day + 1 };
  const [a] = offenePlaetze(state, ctx);
  const g = gastAuf(state, ctx, a.id);
  // Alle Plätze innen belegen
  for (const b of sim.availableBerths(state, ctx)) {
    if (b.exposed || b.reserved || !sim.isFree(state, b.id)) continue;
    state.berths[b.id] = -1;
  }
  const r = V.sturmklar(state, ctx, plan);
  assert.equal(r.verholt, 0);
  assert.equal(r.bleiben, 1);
  assert.equal(state.boats[g].berthId, a.id);
});

test('Gast auf Tagestörn wird nicht verholt', () => {
  const { ctx, state } = neu();
  const plan = { id: 'sturm', startDay: state.day + 1, endDay: state.day + 1 };
  const [a] = offenePlaetze(state, ctx);
  const g = gastAuf(state, ctx, a.id);
  state.boats[g].trip = { away: true };
  const r = V.sturmklar(state, ctx, plan);
  assert.equal(r.verholt, 0);
  assert.equal(state.boats[g].berthId, a.id);
});

test('Sturm im Spielablauf: draußen bewertet schlechter, Ergebnis am Abend, danach frei', () => {
  const { ctx, state, p } = neu();
  const tag = state.day;
  const plan = { id: 'sturm', startDay: tag + 1, endDay: tag + 1 };
  p.geplant = plan;
  const [a, b] = offenePlaetze(state, ctx);
  const drin = gastAuf(state, ctx, a.id, 'S1', 3);
  const draus = gastAuf(state, ctx, b.id, 'S1', 3);
  // Nur einen verholen: den anderen legen wir nach dem Sturmklar wieder hinaus
  V.sturmklar(state, ctx, plan);
  const innen = state.boats[draus].berthId;
  delete state.berths[innen];
  state.berths[b.id] = draus;
  state.boats[draus].berthId = b.id;
  // Nacht vor dem Sturm: zählen
  sim.addHook(ctx, 'modifiers', () => ({ arrivalFactor: 0, ...(state.day === plan.startDay ? { satisfaction: { outer: -1 } } : {}) }));
  for (const k of Object.keys(ctx.rules.arrivalsPerDay)) ctx.rules.arrivalsPerDay[k] = 0;   // nur die Boote aus dem Test
  ctx.rules.firstArrivalAt = null;
  const L = ctx.rules.dayLength + ctx.rules.eveningLength;
  let events = sim.tick(state, ctx, L - state.clock + 1);
  assert.equal(state.day, tag + 1);
  assert.equal(state.modules.vorbereitung.sturm.draussen, 1);
  assert.equal(state.modules.vorbereitung.sturm.innen, 1);
  // Morgens trifft der Sturm nur den Gast draußen
  assert.equal(state.boats[draus].penalty, 1);
  assert.equal(state.boats[drin].penalty, 0);
  // Abend des Sturmtags: Ergebnis
  p.geplant = null;
  p.laufend = plan;
  p.outer = -1;
  events = sim.tick(state, ctx, ctx.rules.dayLength + 1);
  const e = events.find((x) => x.type === 'ereignisErgebnis');
  assert.ok(e, 'Ergebnis am Abend');
  assert.deepEqual({ art: e.art, vorbereitet: e.vorbereitet, verholt: e.verholt, draussen: e.draussen, anker: e.anker }, { art: 'sturm', vorbereitet: true, verholt: 2, draussen: 1, anker: 1 });
  assert.match(V.ergebnisText(e).text, /1 Gast lag an offenen Plätzen und bewerten schlechter|an offenen Plätzen/);
  // Nachts aufgeräumt: offene Plätze wieder frei für Gäste
  p.laufend = null;
  sim.tick(state, ctx, L);
  assert.equal(state.modules.vorbereitung.sturm, undefined);
  const probe = { id: 999, typeId: 'S1', size: 'S', length: 4, beam: 1.8, draft: 0.4, stationed: false, wishes: [], nights: 1 };
  assert.equal(sim.hookWhyNotFit(state, ctx, probe, a), null);
});

test('Ergebnistexte: alle Fälle ohne Platzhalter', () => {
  const faelle = [
    { art: 'sturm', draussen: 0, verholt: 0, anker: 1 },
    { art: 'sturm', draussen: 0, verholt: 3, anker: 1 },
    { art: 'sturm', draussen: 2, verholt: 1, anker: 1 },
    { art: 'sturm', draussen: 1, verholt: 0, anker: 0 },
    { art: 'regatta', vorbereitet: false },
    { art: 'regatta', vorbereitet: true, plaetze: 3, teilnehmer: 0, startgeld: 0 },
    { art: 'regatta', vorbereitet: true, plaetze: 3, teilnehmer: 2, startgeld: 23 },
  ];
  for (const f of faelle) {
    const t = V.ergebnisText(f);
    assert.ok(t.titel && t.text && t.symbol, JSON.stringify(f));
    assert.doesNotMatch(t.text, /undefined|NaN|null/);
  }
  assert.match(V.ergebnisText(faelle[6]).text, /2 Regattaboote lagen.*23 €/);
  assert.match(V.ergebnisText(faelle[3]).text, /Seenotretter/);
});

test('Regatta: Plätze freihalten, vorher leer, dann nur Segler, Startgeld einmal', () => {
  const { ctx, state, p } = neu({ stufe: 4 });
  const tag = state.day;
  const plan = { id: 'regatta', startDay: tag + 2, endDay: tag + 3 };
  const r = V.regattaFreihalten(state, ctx, plan);
  assert.ok(r.ok);
  assert.equal(r.plaetze.length, ECONOMY.ereignisse.regatta.vorbereiten.plaetze[4]);
  for (const id of r.plaetze) assert.ok(!ctx.berthById[id].exposed && !ctx.berthById[id].reserved);
  const platz = ctx.berthById[r.plaetze[0]];
  const segler = { id: 900, typeId: 'S4', size: 'S', length: 3, beam: 1.4, draft: 0.2, stationed: false, wishes: [], nights: 1 };
  const motor = { ...segler, id: 901, typeId: 'S1' };
  // vor dem Start: für alle gesperrt, Schild 'reserviert'
  assert.equal(sim.hookWhyNotFit(state, ctx, segler, platz), 'regatta');
  assert.equal(sim.berthState(state, ctx, platz.id), 'reserviert');
  // noch einmal freihalten: keine doppelten Plätze
  assert.equal(V.regattaFreihalten(state, ctx, plan).plaetze.length, r.plaetze.length);
  // Regattatag: nur Segler, das Schild zeigt frei
  state.day = plan.startDay;
  assert.equal(sim.hookWhyNotFit(state, ctx, segler, platz), null);
  assert.equal(sim.hookWhyNotFit(state, ctx, motor, platz), 'regatta');
  assert.equal(sim.berthState(state, ctx, platz.id), 'frei');
  // Ein Segler legt an, abends Startgeld, am zweiten Abend nicht noch einmal
  const sg = gastAuf(state, ctx, platz.id, 'S4', 2);
  p.laufend = plan;
  const geld0 = state.money;
  const ev = [];
  const add = (a, q, d) => sim.addIncome(state, a, q, d);
  V.abendHook({ state, ctx, events: ev, addIncome: add }, { laufend: () => plan });
  const sg1 = ECONOMY.ereignisse.regatta.vorbereiten.startgeld.S;
  assert.equal(state.money - geld0, sg1);
  state.day = plan.endDay;
  V.abendHook({ state, ctx, events: ev, addIncome: add }, { laufend: () => plan });
  assert.equal(state.money - geld0, sg1, 'Startgeld nur einmal je Boot');
  const e = ev.find((x) => x.type === 'ereignisErgebnis');
  assert.deepEqual({ art: e.art, teilnehmer: e.teilnehmer, startgeld: e.startgeld, plaetze: e.plaetze }, { art: 'regatta', teilnehmer: 1, startgeld: sg1, plaetze: r.plaetze.length });
  assert.ok(state.boats[sg]);
  // Nachts aufgeräumt
  V.nachtHook({ state, ctx }, {});
  assert.equal(state.modules.vorbereitung.regatta, undefined);
  assert.equal(sim.hookWhyNotFit(state, ctx, motor, platz), null);
});

test('Regatta freigeben: Plätze sofort wieder für alle', () => {
  const { ctx, state } = neu();
  const plan = { id: 'regatta', startDay: state.day + 2, endDay: state.day + 3 };
  const r = V.regattaFreihalten(state, ctx, plan);
  const platz = ctx.berthById[r.plaetze[0]];
  V.regattaFreigeben(state);
  const motor = { id: 901, typeId: 'S1', size: 'S', length: 3, beam: 1.4, draft: 0.2, stationed: false, wishes: [], nights: 1 };
  assert.equal(sim.hookWhyNotFit(state, ctx, motor, platz), null);
});

test('Ohne Vorbereitung: Regatta-Ergebnis sagt, was es gebracht hätte', () => {
  const { ctx, state } = neu();
  const plan = { id: 'regatta', startDay: state.day, endDay: state.day };
  const ev = [];
  V.abendHook({ state, ctx, events: ev, addIncome: () => {} }, { laufend: () => plan });
  assert.equal(ev[0].vorbereitet, false);
  assert.match(V.ergebnisText(ev[0]).text, /Startgeld/);
});

test('Falsches Ereignis: nichts passiert', () => {
  const { ctx, state } = neu();
  assert.equal(V.sturmklar(state, ctx, { id: 'regatta', startDay: 5, endDay: 6 }).ok, false);
  assert.equal(V.regattaFreihalten(state, ctx, { id: 'sturm', startDay: 5, endDay: 5 }).ok, false);
  assert.equal(V.sturmklar(state, ctx, null).ok, false);
});

test('Spielstand: Stand liegt in state.modules.vorbereitung und übersteht JSON', () => {
  const { ctx, state } = neu();
  const plan = { id: 'regatta', startDay: state.day + 2, endDay: state.day + 3 };
  V.regattaFreihalten(state, ctx, plan);
  const kopie = JSON.parse(JSON.stringify(state));
  const platz = ctx.berthById[kopie.modules.vorbereitung.regatta.plaetze[0]];
  const motor = { id: 901, typeId: 'S1', size: 'S', length: 3, beam: 1.4, draft: 0.2, stationed: false, wishes: [], nights: 1 };
  assert.equal(sim.hookWhyNotFit(kopie, ctx, motor, platz), 'regatta');
});
