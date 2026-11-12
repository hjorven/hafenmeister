// Dauerlieger (docs/neue-features.md, Abschnitt 3): Logik ohne Browser, mit den echten Zahlen aus economy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import {
  haengeEin, machDauerplatz, hebeAuf, kannDauerplatz, dauerState, draussenBis, fitHook, bewerberFuer, bewerberPacht,
  neuerBewerber, sofortKosten, kuendigeSofort,
  hoechstZahl, anzahl, gastPlaetze, kuendige, umlege, umlegeZiele, wartetAuf, pachtJeTag, regeln,
  ergaenzeAlteStaende, UMWELT,
} from '../web/js/features/dauerlieger.js';

function neu(seed = 7, stufe = 2) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  haengeEin((name, fn) => sim.addHook(ctx, name, fn));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  sim.tick(state, ctx, 1);   // erste Spielsekunde: die ersten Bewerber fragen an
  return { ctx, state };
}

function freierPlatz(state, ctx) {
  // Genug Bewerber, damit jeder Test einen passenden findet
  for (let i = 0; i < 6 && !sim.availableBerths(state, ctx).some((b) => kannDauerplatz(state, ctx, b.id).ok); i++) neuerBewerber(state, ctx);
  return sim.availableBerths(state, ctx).find((b) => kannDauerplatz(state, ctx, b.id).ok)?.id;
}

/** So lange Bewerber erzeugen, bis einer an diesen Platz passt. */
function bewerberFuerPlatz(state, ctx, platz) {
  for (let i = 0; i < 40 && !bewerberFuer(state, ctx, platz).length; i++) neuerBewerber(state, ctx);
  assert.ok(bewerberFuer(state, ctx, platz).length, `kein Bewerber für ${platz}`);
}

/** Ohne Törns (für Tests, die einzelne Abläufe von Hand starten). */
function ruhig(ctx) {
  ctx.rules.dauer = { ...ctx.rules.dauer, toernChance: 0, tagestoernChance: 0 };
}

/** Törn von Hand starten: Boot ist draußen und kommt in der Nacht von Tag bis zurück. */
function aufToern(state, platz, bis, frueherUm = null) {
  const p = dauerState(state).plaetze[platz];
  const boot = state.boats[p.bootId];
  delete state.berths[platz];
  delete state.boats[boot.id];
  boot.status = 'away';
  Object.assign(p, { boot, rueckNacht: bis, frueherUm });
  return p;
}

/** Einen wartenden Gast auf den Platz legen (wie nach dem Zuweisen). */
function gastAuf(state, ctx, platz, nights = 1) {
  const berth = ctx.berthById[platz];
  const id = state.nextId++;
  state.boats[id] = {
    id, typeId: 'S1', size: berth.size === 'M' ? 'M' : 'S', kind: 'motor', length: 4, beam: 1.8, draft: 0.4,
    stationed: false, nights, wishes: [], status: 'waiting', penalty: 0,
  };
  state.queue.push(id);
  const r = sim.assign(state, ctx, id, platz);
  assert.ok(r.ok, `Gast passt nicht auf ${platz}: ${r.reason}`);
  return id;
}

test('Zahlen kommen aus economy.js', () => {
  const { ctx } = neu();
  assert.equal(regeln(ctx).pachtAnteil, ECONOMY.dauerlieger.pachtAnteil);
  assert.equal(regeln(ctx).hoechstAnteil, ECONOMY.dauerlieger.hoechstAnteil);
  assert.equal(regeln(ctx).vorauskasse, ECONOMY.dauerlieger.vorauskasse);
  assert.equal(ctx.rules.stationedFee, ECONOMY.fischer.pachtProTag);
});

test('in Stufe 1 gibt es noch keine Dauerplätze', () => {
  const { ctx, state } = neu(1, 1);
  const id = sim.availableBerths(state, ctx)[0].id;
  assert.equal(kannDauerplatz(state, ctx, id).reason, 'stage');
});

test('Ab Stufe 2 fragen gleich die ersten Bewerber an', () => {
  const { ctx, state } = neu();
  assert.equal(dauerState(state).bewerber.length, ECONOMY.dauerlieger.bewerberStart);
  const { state: s1 } = neu(1, 1);
  assert.equal(dauerState(s1).bewerber.length, 0);
  // Ohne passenden Bewerber kein Dauerplatz
  dauerState(state).bewerber = [];
  const frei = sim.availableBerths(state, ctx).find((b) => !b.reserved && sim.isFree(state, b.id));
  assert.equal(kannDauerplatz(state, ctx, frei.id).reason, 'keinBewerber');
});

test('Bewerber kommen mit der Zeit, höchstens drei, und geben nach einigen Tagen auf', () => {
  const { ctx, state } = neu(12);
  ruhig(ctx);
  let hoechst = 0;
  const gesehen = new Set();
  for (let i = 0; i < 25; i++) {
    sim.runDay(state, ctx);
    const l = dauerState(state).bewerber;
    hoechst = Math.max(hoechst, l.length);
    l.forEach((b) => { gesehen.add(b.id); assert.ok(b.bisTag >= state.day); });
  }
  assert.ok(hoechst <= ECONOMY.dauerlieger.bewerberMax);
  assert.ok(gesehen.size > ECONOMY.dauerlieger.bewerberStart, 'neue Bewerber kommen dazu');
});

test('Vermieten: Saisonpacht für den Rest der Saison kommt sofort, abends nichts mehr', () => {
  const { ctx, state } = neu();
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const b = bewerberFuer(state, ctx, platz).at(-1);
  const a = bewerberPacht(state, ctx, b);
  const sea = sim.season(state, ctx);
  assert.equal(a.tage, ctx.rules.seasonDays - sea.day + 1);
  const vorher = state.money;
  const r = machDauerplatz(state, ctx, platz, b.id);
  assert.ok(r.ok);
  const boot = state.boats[r.boatId];
  assert.equal(boot.typeId, b.artId);
  assert.equal(boot.bootsname, b.bootsname);
  assert.ok(!dauerState(state).bewerber.includes(b), 'Bewerber ist vergeben');
  assert.equal(boot.stationed, true);
  assert.equal(boot.dauer, true);
  assert.equal(state.money, vorher + a.summe);
  // 50 % des Gastpreises je Saisontag
  assert.equal(a.jeTag, Math.round(sim.nightlyFee(state, ctx, boot, 0) * ECONOMY.dauerlieger.pachtAnteil));
  const ev = r.events.find((e) => e.type === 'dauerPacht');
  assert.equal(ev.amount, a.summe);
  // Belegter Platz ist kein zweites Mal möglich
  assert.equal(kannDauerplatz(state, ctx, platz).ok, false);
  // Abends kommt keine Pacht mehr dazu (schon bezahlt)
  const events = sim.tick(state, ctx, ctx.rules.dayLength + 1);
  assert.ok(!events.some((e) => e.type === 'stationedFee' && e.boatId === r.boatId));
});

test('Ohne Vorauskasse: Dauerlieger zahlt jeden Abend 50 % seines Gastpreises, nicht die Fischerpacht', () => {
  const { ctx, state } = neu();
  ruhig(ctx);
  ctx.rules.dauer.vorauskasse = false;
  const platz = freierPlatz(state, ctx);
  const vorher = state.money;
  const { boatId } = machDauerplatz(state, ctx, platz);
  assert.equal(state.money, vorher, 'nichts im Voraus');
  const events = sim.tick(state, ctx, ctx.rules.dayLength + 1);
  const fee = events.find((e) => e.type === 'stationedFee' && e.boatId === boatId);
  assert.equal(fee.amount, pachtJeTag(state, ctx, state.boats[boatId]));
});

test('Fischer zahlen weiter die feste Pacht', () => {
  const { ctx, state } = neu(2, 3);
  const fischer = Object.values(state.boats).find((b) => b.stationed && !b.dauer);
  if (!fischer) return;   // ohne Fischerplatz in dieser Stufe nichts zu prüfen
  const events = sim.tick(state, ctx, ctx.rules.dayLength + 1);
  assert.equal(events.find((e) => e.type === 'stationedFee' && e.boatId === fischer.id).amount, ECONOMY.fischer.pachtProTag);
});

test('Höchstens ein Viertel der Plätze', () => {
  const { ctx, state } = neu(4);
  const max = hoechstZahl(state, ctx);
  for (let i = 0; i < 3 * max; i++) neuerBewerber(state, ctx);
  assert.equal(max, Math.floor(gastPlaetze(state, ctx).length * 0.25));
  assert.ok(max >= 1, 'in Stufe 2 mindestens ein Dauerplatz');
  for (let i = 0; i < max; i++) assert.ok(machDauerplatz(state, ctx, freierPlatz(state, ctx)).ok);
  assert.equal(anzahl(state), max);
  const frei = sim.availableBerths(state, ctx).find((b) => !b.reserved && sim.isFree(state, b.id));
  assert.equal(kannDauerplatz(state, ctx, frei.id).reason, 'voll');
});

test('Dauerlieger haben einen Namen am Heck, aber keinen fremden Heimathafen', async () => {
  const { beschreibung } = await import('../web/js/features/stammgaeste.js');
  const { BOOTSNAMEN } = await import('../web/js/data/bootsnamen.js');
  const { ctx, state } = neu(2, 3);
  const a = state.boats[machDauerplatz(state, ctx, freierPlatz(state, ctx)).boatId];
  const b = state.boats[machDauerplatz(state, ctx, freierPlatz(state, ctx)).boatId];
  assert.ok(BOOTSNAMEN.includes(a.bootsname));
  assert.notEqual(a.bootsname, b.bootsname);
  assert.equal(a.heimathafen, undefined);
  assert.equal(beschreibung(a), `„${a.bootsname}“ · Dauerlieger`);
});

test('Kündigung zum Saisonende: Boot bleibt bis zum Winter, dann ist der Platz wieder frei', () => {
  const { ctx, state } = neu();
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  assert.ok(kuendige(state, platz, true).ok);
  sim.runDay(state, ctx);
  assert.equal(state.berths[platz], boatId, 'mitten in der Saison bleibt es');
  // Zurücknehmen und wieder kündigen geht
  kuendige(state, platz, false);
  assert.equal(dauerState(state).plaetze[platz].kuendigung, null);
  kuendige(state, platz, true);
  while (!sim.season(state, ctx).winter) sim.runDay(state, ctx);
  assert.equal(state.boats[boatId], undefined);
  assert.equal(dauerState(state).plaetze[platz], undefined);
  assert.ok(sim.isFree(state, platz) || state.leaving?.[platz]);
});

test('Neue Saison: alle Dauerlieger zahlen die ganze Saison im Voraus', () => {
  const { ctx, state } = neu();
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const jeTag = pachtJeTag(state, ctx, state.boats[boatId]);
  while (sim.season(state, ctx).year === 1) sim.runDay(state, ctx);
  // runDay endet am Morgen von Tag 1 der neuen Saison; die Pacht kam in der Nacht davor
  const p = dauerState(state).plaetze[platz];
  assert.equal(p.jahr, 2);
  assert.equal(p.pacht, jeTag * ctx.rules.seasonDays);
});

test('Im Winter vermietet: bezahlt die ganze nächste Saison und zahlt sie nicht doppelt', () => {
  const { ctx, state } = neu();
  ruhig(ctx);
  while (!sim.season(state, ctx).winter) sim.runDay(state, ctx);
  const platz = freierPlatz(state, ctx);
  const b = bewerberFuer(state, ctx, platz)[0];
  const a = bewerberPacht(state, ctx, b);
  assert.equal(a.tage, ctx.rules.seasonDays);
  machDauerplatz(state, ctx, platz, b.id);
  const geld = state.money;
  while (sim.season(state, ctx).winter) sim.runDay(state, ctx);
  assert.equal(dauerState(state).plaetze[platz].pacht, a.summe);
  // In der Nacht zur neuen Saison keine zweite Pacht für diesen Platz
  assert.ok(state.money - geld < a.summe);
});

test('Törn: Platz wird grün, nur Gäste, die rechtzeitig abreisen, passen, Boot kommt zurück', () => {
  const { ctx, state } = neu(3);
  ctx.rules.dauer.frueherZurueck = 0;
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  let tage = 0;
  while (draussenBis(state, platz) == null && tage < 200) { sim.runDay(state, ctx); tage++; }
  const bis = draussenBis(state, platz);
  assert.ok(bis != null, 'innerhalb von 200 Tagen sollte ein Törn vorkommen');
  assert.equal(sim.isFree(state, platz), true);
  assert.equal(state.boats[boatId], undefined, 'draußen ist das Boot nicht im Hafen');
  const berth = ctx.berthById[platz];
  assert.equal(fitHook({ state, boat: { stationed: false, nights: bis - state.day + 1 }, berth }), null);
  assert.equal(fitHook({ state, boat: { stationed: false, nights: bis - state.day + 2 }, berth }), 'dauerZurueck');
  while (state.day <= bis) sim.runDay(state, ctx);
  for (let i = 0; i < 4 && state.berths[platz] !== boatId; i++) sim.runDay(state, ctx);
  assert.equal(state.berths[platz], boatId);
  assert.equal(state.boats[boatId].status, 'moored');
});

test('Bei Sturm und im Winter fährt kein Dauerlieger raus', () => {
  const { ctx, state } = neu(8);
  ctx.rules.dauer = { ...ctx.rules.dauer, toernChance: 0.5, tagestoernChance: 0.5 };
  const platz = freierPlatz(state, ctx);
  machDauerplatz(state, ctx, platz);
  UMWELT.sturm = () => true;
  try {
    for (let i = 0; i < 5; i++) {
      const ev = [];
      ctx.hooks.night.forEach((fn) => fn({ state, ctx, events: ev }));
      assert.ok(!ev.some((e) => e.type === 'dauerAuslaufen'));
    }
  } finally { UMWELT.sturm = () => false; }
});

test('Kommt das Boot nachts zurück und ein Gast bleibt noch, wartet es eine Nacht', () => {
  const { ctx, state } = neu(5);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  machDauerplatz(state, ctx, platz);
  const p = aufToern(state, platz, state.day);
  state.berths[platz] = 999;   // z. B. durch Sturm länger geblieben
  const events = [];
  ctx.hooks.night.forEach((fn) => fn({ state, ctx, events }));
  assert.equal(p.rueckNacht, state.day + 1);
  assert.equal(state.berths[platz], 999);
});

test('Gast wurde heute Nacht abgerechnet und legt erst morgens ab: Dauerboot kommt trotzdem zurück, Gast legt sofort ab', () => {
  const { ctx, state } = neu(5);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  aufToern(state, platz, state.day);
  state.leaving = { [platz]: { boatId: 998, elapsed: 0, at: 30, off: false } };
  const events = [];
  ctx.hooks.night.forEach((fn) => fn({ state, ctx, events }));
  assert.equal(state.berths[platz], boatId);
  assert.ok(events.some((e) => e.type === 'dauerEinlaufen'));
  const ev = sim.tick(state, ctx, 1);
  assert.ok(ev.some((e) => e.type === 'castOff' && e.berthId === platz));
});

test('Früher zurück, Platz frei: legt am Nachmittag gleich an', () => {
  const { ctx, state } = neu(6);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  aufToern(state, platz, state.day, 0.5);
  const ev = sim.tick(state, ctx, ctx.rules.dayLength * 0.5 + 1);
  assert.ok(ev.some((e) => e.type === 'dauerEinlaufen' && e.boatId === boatId));
  assert.equal(state.berths[platz], boatId);
});

test('Früher zurück, Gast liegt noch da: Dauerlieger wartet, Gast wird umgelegt, Dauerlieger legt an', () => {
  const { ctx, state } = neu(6);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  aufToern(state, platz, state.day, 0.5);
  const gast = gastAuf(state, ctx, platz, 1);
  let ev = sim.tick(state, ctx, ctx.rules.dayLength * 0.5 + 1);
  const w = ev.find((e) => e.type === 'dauerWartet');
  assert.ok(w);
  assert.equal(w.gastId, gast);
  assert.equal(wartetAuf(state, gast), platz);
  // Neue Gäste dürfen jetzt nicht mehr auf den Platz
  assert.equal(fitHook({ state, boat: { stationed: false, nights: 1 }, berth: ctx.berthById[platz] }), 'dauer');
  // Ziel muss frei sein und passen
  const ziele = umlegeZiele(state, ctx, gast);
  assert.ok(ziele.length > 0);
  assert.ok(!ziele.includes(platz));
  assert.equal(umlege(state, ctx, gast, platz).ok, false);
  const r = umlege(state, ctx, gast, ziele[0]);
  assert.ok(r.ok);
  assert.equal(state.berths[ziele[0]], gast);
  assert.equal(state.boats[gast].berthId, ziele[0]);
  assert.equal(state.berths[platz], boatId);
  assert.ok(r.events.some((e) => e.type === 'dauerUmgelegt'));
  assert.ok(r.events.some((e) => e.type === 'dauerEinlaufen'));
  // Abends keine Kündigung
  ev = sim.tick(state, ctx, ctx.rules.dayLength);
  assert.equal(dauerState(state).plaetze[platz].kuendigung, null);
});

test('Gast nicht umgelegt: Dauerlieger kündigt zum Saisonende und kommt nachts trotzdem an seinen Platz', () => {
  const { ctx, state } = neu(6);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  aufToern(state, platz, state.day, 0.5);
  gastAuf(state, ctx, platz, 1);
  const ev = sim.tick(state, ctx, ctx.rules.dayLength + 1);
  assert.ok(ev.some((e) => e.type === 'dauerKuendigung' && e.von === 'lieger'));
  const p = dauerState(state).plaetze[platz];
  assert.equal(p.kuendigung, 'lieger');
  // Spieler kann die Kündigung des Dauerliegers nicht zurücknehmen
  assert.equal(kuendige(state, platz, false).ok, false);
  sim.tick(state, ctx, ctx.rules.eveningLength + 1);
  assert.equal(state.berths[platz], boatId);
  assert.equal(p.wartet, false);
});

test('Hafenbüro-Automatik beachtet die Dauerplätze (fittingBerths nutzt den Hook)', () => {
  const { ctx, state } = neu(9);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const boot = state.boats[boatId];
  aufToern(state, platz, state.day);
  const gast = { id: 500, status: 'waiting', stationed: false, nights: 2, size: boot.size, length: 1, beam: 1, draft: 0.1, wishes: [] };
  state.boats[500] = gast;
  assert.ok(!sim.fittingBerths(state, ctx, 500).includes(platz));
  gast.nights = 1;
  assert.ok(sim.fittingBerths(state, ctx, 500).includes(platz));
});

test('hebeAuf gibt den Platz frei', () => {
  const { ctx, state } = neu();
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  assert.ok(hebeAuf(state, ctx, platz).ok);
  assert.equal(state.boats[boatId], undefined);
  assert.equal(sim.isFree(state, platz), true);
});

test('Alter Spielstand ohne Vertrag: gilt als bezahlt für die laufende Saison', () => {
  const { ctx, state } = neu();
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  dauerState(state).plaetze[platz] = { bootId: boatId, rueckNacht: null, boot: null, tagestoern: false };
  ergaenzeAlteStaende(state, ctx);
  const p = dauerState(state).plaetze[platz];
  assert.equal(p.jahr, 1);
  assert.equal(p.kuendigung, null);
  assert.equal(p.wartet, false);
});

test('Spielstand bleibt JSON (Speichern und Laden)', () => {
  const { ctx, state } = neu(11);
  machDauerplatz(state, ctx, freierPlatz(state, ctx));
  for (let i = 0; i < 40; i++) sim.runDay(state, ctx);
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
  bewerberFuerPlatz(state, ctx, 'B01');
  // B01 und B17 gibt es ab Stufe 3 nicht mehr
  assert.ok(ctx.berthById.B01.stages.includes(2) && !ctx.berthById.B01.stages.includes(3));
  const dauer = machDauerplatz(state, ctx, 'B01');
  assert.ok(dauer.ok);
  bewerberFuerPlatz(state, ctx, 'B02');
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

test('Sofort kündigen kostet die Pacht der restlichen Tage und eine Entschädigung', () => {
  const { ctx, state } = neu(13);
  ruhig(ctx);
  const platz = freierPlatz(state, ctx);
  const { boatId } = machDauerplatz(state, ctx, platz);
  const jeTag = pachtJeTag(state, ctx, state.boats[boatId]);
  sim.runDay(state, ctx);
  const k = sofortKosten(state, ctx, platz);
  const rest = ctx.rules.seasonDays - sim.season(state, ctx).day;
  assert.equal(k.rest, jeTag * rest);
  assert.equal(k.zuschlag, Math.round(jeTag * ctx.rules.seasonDays * ECONOMY.dauerlieger.kuendigungsZuschlag));
  // Zu wenig Geld: geht nicht
  state.money = k.summe - 1;
  assert.equal(kuendigeSofort(state, ctx, platz).reason, 'money');
  state.money = k.summe + 100;
  const r = kuendigeSofort(state, ctx, platz);
  assert.ok(r.ok);
  assert.equal(state.money, 100);
  assert.equal(state.boats[boatId], undefined);
  assert.equal(dauerState(state).plaetze[platz], undefined);
  // Ausnutzen geht nicht: vermieten und gleich wieder kündigen bringt nichts ein
  const platz2 = freierPlatz(state, ctx);
  const g0 = state.money + 10000;
  state.money = g0;
  machDauerplatz(state, ctx, platz2);
  kuendigeSofort(state, ctx, platz2);
  assert.ok(state.money <= g0);
});
