// Aufstieg feiern und Endlosspiel (docs/aufstieg.md, Paket P16): Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import {
  aufstiegState, sichereChronik, stufeAbschliessen, starteEndlos, saisonStand, werteSaison,
  zieleFuer, rang, nacht, neuInStufe,
} from '../web/js/features/aufstieg.js';

function neu(seed = 5) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  sim.addHook(ctx, 'night', nacht);
  sim.addHook(ctx, 'stageUp', ({ state, from, to }) => stufeAbschliessen(state, from, to));
  const state = createState({ seed });
  sichereChronik(state);
  return { ctx, state };
}

// Spielt n Tage: alle Wartenden werden zugewiesen, abends wird kassiert.
function spiele(state, ctx, tage) {
  const r = ctx.rules;
  const events = [];
  const ziel = state.day + tage;
  let schutz = 0;
  while (state.day < ziel && schutz++ < tage * 400) {
    events.push(...sim.tick(state, ctx, 2));
    events.push(...sim.autoAssign(state, ctx).events || []);
    if (state.phase === 'evening') events.push(...(sim.collectAll(state, ctx, true).events || []));
  }
  assert.ok(state.day >= ziel, 'Tage laufen');
  return events.concat([]);
}

test('Stufenaufstieg hält Zahlen der alten Stufe fest', () => {
  const { ctx, state } = neu();
  spiele(state, ctx, 6);
  const goal = ctx.rules.stageGoals[1];
  // Ziel erfüllen und ausbauen
  state.stageGuests = goal.guests;
  state.ratings = state.ratings.map(() => 5);
  state.money += goal.cost + 100;
  const gaeste = state.guests;
  const einnahmen = state.stats.totalIncome;
  assert.ok(gaeste > 0, 'es gab Gäste');
  const r = sim.advanceStage(state, ctx);
  assert.equal(r.ok, true);
  const m = aufstiegState(state);
  const e = m.stufen.find((s) => s.stufe === 1);
  assert.ok(e, 'Eintrag Stufe 1');
  assert.equal(e.abTag, 1);
  assert.equal(e.bisTag, state.day);
  assert.equal(e.gaeste, gaeste);
  assert.equal(e.einnahmen, einnahmen);
  assert.ok(e.besterTag > 0, 'bester Tag gemerkt');
  assert.equal(m.chronik[2].abTag, state.day);
  assert.equal(m.chronik[2].gaeste, gaeste);
});

test('Was die neue Stufe bringt, kommt aus den Spielzahlen', () => {
  const { ctx } = neu();
  const zwei = neuInStufe(ctx, 1, 2);
  assert.ok(zwei.some((t) => /Liegepl/.test(t)), zwei.join(' | '));
  assert.ok(zwei.some((t) => /\(M\)/.test(t)), 'M-Boote kommen ab Stufe 2');
  assert.ok(zwei.some((t) => /Stegprojekte/.test(t)));
  const drei = neuInStufe(ctx, 2, 3);
  assert.ok(drei.some((t) => /\(L\)/.test(t)));
  const fuenf = neuInStufe(ctx, 4, 5);
  assert.ok(fuenf.some((t) => /\(XL\)/.test(t)));
  for (let n = 2; n <= ctx.rules.maxStage; n++) {
    for (const t of neuInStufe(ctx, n - 1, n)) assert.equal(typeof t, 'string');
  }
});

test('Saisonziele steigen je Saison und bleiben unter der Obergrenze', () => {
  const z = ECONOMY.endlos.ziele;
  const eins = zieleFuer(1);
  assert.equal(eins.length, 4);
  assert.deepEqual(eins.map((x) => x.art), ['gaeste', 'ruf', 'grossschiffe', 'einnahmen']);
  assert.equal(zieleFuer(2)[3].art, 'xl');
  const g1 = eins.find((x) => x.art === 'gaeste').soll;
  const g3 = zieleFuer(3).find((x) => x.art === 'gaeste').soll;
  assert.ok(g3 > g1);
  for (const n of [1, 5, 50]) {
    for (const x of zieleFuer(n)) assert.ok(x.soll <= z[x.art].max + 1e-9, `${x.art} Saison ${n}`);
  }
  // anteilig bei spätem Start, Ruf bleibt gleich
  const halb = zieleFuer(1, 0.5);
  assert.ok(halb.find((x) => x.art === 'gaeste').soll < g1);
  assert.equal(halb.find((x) => x.art === 'ruf').soll, eins.find((x) => x.art === 'ruf').soll);
});

test('Ränge nach Sternen', () => {
  assert.equal(rang(0).titel, ECONOMY.endlos.raenge[0].titel);
  const letzter = ECONOMY.endlos.raenge.at(-1);
  assert.equal(rang(letzter.sterne + 100).titel, letzter.titel);
  assert.equal(rang(letzter.sterne + 100).naechster, null);
});

test('Endlosspiel: Start mitten in der Saison anteilig, spät erst nächste Saison', () => {
  const { ctx, state } = neu();
  state.day = 11; // Tag 11 der Saison, 20 Tage übrig
  state.regionDone = true;
  const e = starteEndlos(state, ctx);
  assert.equal(e.saison, 1);
  assert.equal(e.wartet, false);
  const tage = ctx.rules.seasonDays;
  assert.ok(Math.abs(e.anteil - (tage - 10) / tage) < 1e-9);
  // zweimal starten ändert nichts
  assert.equal(starteEndlos(state, ctx), e);

  const b = neu();
  b.state.day = ctx.rules.seasonDays - 2; // nur noch 3 Tage
  b.state.regionDone = true;
  const w = starteEndlos(b.state, b.ctx);
  assert.equal(w.wartet, true);
  const st = saisonStand(b.state, b.ctx);
  assert.equal(st.wartet, true);
  assert.equal(st.tageBisStart, ctx.rules.seasonDays + ctx.rules.winterDays - b.state.day + 1);
});

test('Saisonende wertet, gibt Sterne und Geld, Winter danach neue Ziele', () => {
  const { ctx, state } = neu();
  state.regionDone = true;
  state.day = 1;
  starteEndlos(state, ctx);
  const m = aufstiegState(state);
  // Ziele künstlich erfüllen: zwei von vier
  state.guests += 5000;
  state.bigVisits = (state.bigVisits || 0) + 100;
  state.ratings = state.ratings.map(() => 1);
  const geld = state.money;
  state.day = ctx.rules.seasonDays; // letzter Saisontag
  const events = [];
  nacht({ state, ctx, events });
  const ende = events.find((e) => e.type === 'seasonEnd');
  assert.ok(ende, 'Saisonende gemeldet');
  assert.equal(ende.erreicht, 2);
  assert.equal(ende.sterne, 2);
  assert.equal(state.money - geld, 2 * ECONOMY.endlos.belohnung.jeZiel);
  assert.equal(m.endlos.wartet, true);
  // Winter: Stand wartet, am letzten Wintertag beginnt Saison 2
  state.day = ctx.rules.seasonDays + ctx.rules.winterDays;
  const ev2 = [];
  nacht({ state, ctx, events: ev2 });
  const start = ev2.find((e) => e.type === 'seasonStart');
  assert.ok(start, 'neue Saison');
  assert.equal(start.saison, 2);
  assert.equal(start.jahr, 2);
  assert.equal(m.endlos.ziele.find((z) => z.art === 'xl').art, 'xl');
});

test('Alle Ziele: Bonus obendrauf', () => {
  const { ctx, state } = neu();
  state.regionDone = true;
  starteEndlos(state, ctx);
  state.guests += 99999;
  state.stats.totalIncome += 9999999;
  state.bigVisits = 999;
  state.ratings = state.ratings.map(() => 5);
  const geld = state.money;
  const ende = werteSaison(state, ctx, []);
  assert.equal(ende.erreicht, 4);
  const b = ECONOMY.endlos.belohnung;
  assert.equal(state.money - geld, 4 * b.jeZiel + b.alleZiele);
});

test('Nacht-Hook startet das Endlosspiel nach dem Laden und zählt XL-Gäste', () => {
  const { ctx, state } = neu();
  state.regionDone = true;
  const xl = ctx.types.find((t) => t.size === 'XL');
  nacht({ state, ctx, events: [{ type: 'departed', typeId: xl.id }, { type: 'departed', typeId: xl.id, reason: 'rebuild' }] });
  const m = aufstiegState(state);
  assert.equal(m.xl, 1);
  assert.ok(m.endlos);
});

test('Spielstand mit Chronik und Endlosspiel übersteht Speichern und Laden', () => {
  const { ctx, state } = neu();
  state.regionDone = true;
  starteEndlos(state, ctx);
  const geladen = deserialize(serialize(state));
  assert.deepEqual(geladen.modules.aufstieg, state.modules.aufstieg);
  assert.equal(saisonStand(geladen, ctx).aktiv, true);
});

test('Bester Tag zählt Einnahmen vor dem Aufstieg nicht zur neuen Stufe', () => {
  const { ctx, state } = neu();
  state.stats.dayIncome = 300;          // heute schon in Stufe 1 verdient
  aufstiegState(state).chronik[1].besterTag = 100;
  stufeAbschliessen(state, 1, 2);
  const m = aufstiegState(state);
  assert.equal(m.stufen[0].besterTag, 300, 'alte Stufe bekommt den Tag');
  state.stats.dayIncome = 340;          // nach dem Aufstieg kamen 40 € dazu
  nacht({ state: Object.assign(state, { stage: 2 }), ctx, events: [] });
  assert.equal(m.chronik[2].besterTag, 40);
});
