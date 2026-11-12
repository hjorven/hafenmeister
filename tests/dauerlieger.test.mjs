// Dauerlieger (docs/neue-features.md, Abschnitt 3): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import {
  DAUER, haengeEin, machDauerplatz, hebeAuf, kannDauerplatz, dauerState, draussenBis, fitHook,
} from '../web/js/features/dauerlieger.js';

function neu(seed = 7, stufe = 2) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  haengeEin((name, fn) => sim.addHook(ctx, name, fn));
  const state = createState({ seed });
  state.stage = stufe;
  sim.tick(state, ctx, 0);
  return { ctx, state };
}

function freierPlatz(state, ctx) {
  return sim.availableBerths(state, ctx).find((b) => kannDauerplatz(state, ctx, b.id).ok).id;
}

test('in Stufe 1 gibt es noch keine Dauerplätze', () => {
  const { ctx, state } = neu(1, 1);
  const id = sim.availableBerths(state, ctx)[0].id;
  assert.equal(kannDauerplatz(state, ctx, id).reason, 'stage');
});

test('Dauerplatz anlegen: Boot liegt fest und zahlt abends den festen Anteil', () => {
  const { ctx, state } = neu();
  const platz = freierPlatz(state, ctx);
  const r = machDauerplatz(state, ctx, platz);
  assert.ok(r.ok);
  const boot = state.boats[r.boatId];
  assert.equal(boot.stationed, true);
  assert.equal(boot.dauer, true);
  assert.equal(state.berths[platz], r.boatId);
  assert.ok(r.events.some((e) => e.type === 'dauerNeu'));
  // Belegter Platz ist kein zweites Mal möglich
  assert.equal(kannDauerplatz(state, ctx, platz).ok, false);
  // Abends Geld ohne Zutun
  const vorher = state.money;
  sim.tick(state, ctx, ctx.rules.dayLength + 1);
  const fee = Math.round(sim.nightlyFee(state, ctx, boot, 0) * ctx.rules.stationedFeeShare);
  assert.ok(fee > 0);
  assert.ok(state.money >= vorher + fee);
});

test('Dauerlieger haben einen Namen am Heck, aber keinen fremden Heimathafen', async () => {
  const { beschreibung } = await import('../web/js/features/stammgaeste.js');
  const { BOOTSNAMEN } = await import('../web/js/data/bootsnamen.js');
  const { ctx, state } = neu();
  const a = state.boats[machDauerplatz(state, ctx, freierPlatz(state, ctx)).boatId];
  const b = state.boats[machDauerplatz(state, ctx, freierPlatz(state, ctx)).boatId];
  assert.ok(BOOTSNAMEN.includes(a.bootsname));
  assert.notEqual(a.bootsname, b.bootsname);
  assert.equal(a.heimathafen, undefined);
  assert.equal(beschreibung(a), `„${a.bootsname}“ · Dauerlieger`);
});

test('Dauerplatz aufheben gibt den Platz frei', () => {
  const { ctx, state } = neu();
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const r = hebeAuf(state, ctx, platz);
  assert.ok(r.ok);
  assert.equal(state.boats[boatId], undefined);
  assert.equal(sim.isFree(state, platz), true);
  assert.equal(dauerState(state).plaetze[platz], undefined);
});

test('Törn: Platz wird grün, nur Gäste, die rechtzeitig abreisen, passen, Boot kommt zurück', () => {
  const { ctx, state } = neu(3);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  // Tage laufen lassen, bis das Boot auf Törn geht
  let tage = 0;
  while (draussenBis(state, platz) == null && tage < 200) { sim.runDay(state, ctx); tage++; }
  const bis = draussenBis(state, platz);
  assert.ok(bis != null, 'innerhalb von 200 Tagen sollte ein Törn vorkommen');
  assert.equal(sim.isFree(state, platz), true);
  assert.equal(state.boats[boatId], undefined, 'draußen ist das Boot nicht im Hafen');
  const berth = ctx.berthById[platz];
  const passt = { stationed: false, nights: bis - state.day + 1 };
  const zuLang = { stationed: false, nights: bis - state.day + 2 };
  assert.equal(fitHook({ state, boat: passt, berth }), null);
  assert.equal(fitHook({ state, boat: zuLang, berth }), 'dauerZurueck');
  // Zurück nach Ablauf (liegt gerade ein Gast in der Box, der sich selbst eingefahren hat, wartet es noch)
  while (state.day <= bis) sim.runDay(state, ctx);
  for (let i = 0; i < 4 && state.berths[platz] !== boatId; i++) sim.runDay(state, ctx);
  assert.equal(state.berths[platz], boatId);
  assert.equal(state.boats[boatId].status, 'moored');
});

test('Kommt das Boot zurück und ein Gast liegt noch da, wartet es eine Nacht', () => {
  const { ctx, state } = neu(5);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const p = dauerState(state).plaetze[platz];
  // Törn von Hand starten
  const boot = state.boats[boatId];
  delete state.berths[platz];
  delete state.boats[boatId];
  boot.status = 'away';
  Object.assign(p, { boot, rueckNacht: state.day });
  // Gast belegt den Platz (z. B. durch Sturm länger geblieben)
  state.berths[platz] = 999;
  const events = [];
  const alt = { ...DAUER };
  try {
    DAUER.toernChance = 0; DAUER.tagestoernChance = 0;
    ctx.hooks.night.forEach((fn) => fn({ state, ctx, events }));
  } finally { Object.assign(DAUER, alt); }
  assert.equal(p.rueckNacht, state.day + 1);
  assert.equal(state.berths[platz], 999);
});

test('Gast wurde heute Nacht abgerechnet und legt erst morgens ab: Dauerboot kommt trotzdem zurück, Gast legt sofort ab', () => {
  const { ctx, state } = neu(5);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const p = dauerState(state).plaetze[platz];
  const boot = state.boats[boatId];
  delete state.berths[platz];
  delete state.boats[boatId];
  boot.status = 'away';
  Object.assign(p, { boot, rueckNacht: state.day });
  // Gast ist abgerechnet, hält die Box aber bis zum Ablegen am Vormittag
  state.leaving = { [platz]: { boatId: 998, elapsed: 0, at: 30, off: false } };
  const events = [];
  const alt = { ...DAUER };
  try {
    DAUER.toernChance = 0; DAUER.tagestoernChance = 0;
    ctx.hooks.night.forEach((fn) => fn({ state, ctx, events }));
  } finally { Object.assign(DAUER, alt); }
  assert.equal(state.berths[platz], boatId);
  assert.ok(events.some((e) => e.type === 'dauerEinlaufen'));
  // Am Morgen legt der Gast sofort ab, nicht erst zur geplanten Zeit
  const ev = sim.tick(state, ctx, 1);
  assert.ok(ev.some((e) => e.type === 'castOff' && e.berthId === platz));
});

test('Hafenbüro-Automatik beachtet die Dauerplätze (fittingBerths nutzt den Hook)', () => {
  const { ctx, state } = neu(9);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const p = dauerState(state).plaetze[platz];
  const boot = state.boats[boatId];
  delete state.berths[platz];
  delete state.boats[boatId];
  Object.assign(p, { boot, rueckNacht: state.day });   // kommt heute Nacht zurück
  const gast = { id: 500, status: 'waiting', stationed: false, nights: 2, size: boot.size, length: 1, beam: 1, draft: 0.1, wishes: [] };
  state.boats[500] = gast;
  assert.ok(!sim.fittingBerths(state, ctx, 500).includes(platz));
  gast.nights = 1;
  assert.ok(sim.fittingBerths(state, ctx, 500).includes(platz));
});

test('Spielstand bleibt JSON (Speichern und Laden)', () => {
  const { ctx, state } = neu(11);
  machDauerplatz(state, ctx, freierPlatz(state, ctx));
  for (let i = 0; i < 20; i++) sim.runDay(state, ctx);
  const kopie = JSON.parse(JSON.stringify(state));
  assert.deepEqual(kopie.modules.dauer, state.modules.dauer);
});

test('Stufenausbau: Gäste auf wegfallenden Plätzen reisen ab, Dauerlieger ziehen samt Dauerplatz um', async () => {
  const { ECONOMY } = await import('../web/js/data/economy.js');
  const rules = sim.rulesFromEconomy(ECONOMY);
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });
  ctx.rules.queue.selfEnterAfter = null;
  haengeEin((name, fn) => sim.addHook(ctx, name, fn));
  const state = sim.applyTestStage(createState({ seed: 3, rules }), ctx, 2);
  state.testmodus = false;
  sim.tick(state, ctx, 0);
  // B01 und B17 gibt es ab Stufe 3 nicht mehr
  assert.ok(ctx.berthById.B01.stages.includes(2) && !ctx.berthById.B01.stages.includes(3));
  const dauer = machDauerplatz(state, ctx, 'B01');
  assert.ok(dauer.ok);
  const weg = machDauerplatz(state, ctx, 'B02'); // dieses Boot ist beim Ausbau auf Törn
  const p2 = dauerState(state).plaetze.B02;
  const boot2 = state.boats[weg.boatId];
  delete state.berths.B02; delete state.boats[boot2.id];
  boot2.status = 'away'; p2.boot = boot2; p2.rueckNacht = state.day + 2;
  // Gast auf B17 (T-Kopf) mit offenem Liegegeld, Gast auf A03 bleibt
  const gast = (id, platz) => {
    const b = { id, typeId: 'S1', modelId: null, name: 'Gast', size: 'S', length: 4, beam: 1.4, draft: 0.2, motor: false, special: false,
      dayVisitors: 0, stationed: false, wishes: [], nights: 3, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
      berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0 };
    state.boats[id] = b; state.queue.push(id);
    assert.ok(sim.assign(state, ctx, id, platz).ok, platz);
    return b;
  };
  const g1 = gast(9001, 'B17');
  const g2 = gast(9002, 'A03');
  assert.ok(g1.pendingFee > 0);
  const offen = g1.pendingFee;
  state.money = 1e6; state.guests = 1e4; state.stageGuests = 1e4; state.ratings = Array(20).fill(5);
  const geld = state.money - sim.canAdvanceStage(state, ctx).goal.cost;
  const gaeste = state.guests;
  const r = sim.advanceStage(state, ctx);
  assert.ok(r.ok);
  assert.equal(state.stage, 3);
  // Gast vom T-Kopf: abgerechnet, gezählt, legt sofort ab
  const dep = r.events.find((e) => e.type === 'departed' && e.boatId === 9001);
  assert.ok(dep && dep.leaveAt === 0 && dep.reason === 'rebuild');
  assert.equal(state.boats[9001], undefined);
  assert.equal(state.money, geld + offen);
  assert.equal(state.guests, gaeste + 1);
  assert.equal(state.boats[9002].berthId, 'A03', 'Gast auf bleibendem Platz bleibt');
  // Dauerlieger im Hafen: umgezogen, Dauerplatz mit
  const zug = r.events.find((e) => e.type === 'relocated' && e.boatId === dauer.boatId);
  assert.ok(zug, 'Dauerlieger zieht um');
  assert.equal(state.berths[zug.to], dauer.boatId);
  assert.equal(state.boats[dauer.boatId].berthId, zug.to);
  assert.ok(ctx.berthById[zug.to].stages.includes(3));
  const d = dauerState(state).plaetze;
  assert.equal(d.B01, undefined);
  assert.equal(d[zug.to].bootId, dauer.boatId);
  // Dauerlieger auf Törn: Dauerplatz zieht um, das Boot kommt dort zurück
  assert.equal(d.B02, undefined);
  const [neu2] = Object.entries(d).find(([, p]) => p.bootId === boot2.id);
  assert.ok(ctx.berthById[neu2].stages.includes(3) && neu2 !== zug.to);
  for (let i = 0; i < 6 && state.berths[neu2] !== boot2.id; i++) sim.runDay(state, ctx);
  assert.equal(state.berths[neu2], boot2.id);
  // Kein Boot liegt mehr auf einem Platz, den es nicht gibt
  for (const [platz] of Object.entries(state.berths)) assert.ok(ctx.berthById[platz].stages.includes(state.stage), platz);
});
