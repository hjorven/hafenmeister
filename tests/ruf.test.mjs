// Ruf schwerer machen (Roadmap P19, docs/ruf.md): Wünsche je Bootsart, Liegegeld je Art,
// Wünsche an Angebote an Land, Ruf lockt große Boote und seltene Modelle. Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { ANGEBOT_TEXTE, WUNSCH_TEXTE, wunschFuerService } from '../web/js/data/wuensche-texte.js';
import { ANGEBOT_BILDER } from '../web/js/ui/wunsch-bilder.js';

function neu({ seed = 3, stufe = 4, offers = {}, ruf = null } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  sim.addHook(ctx, 'modifiers', () => ({ offers }));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  if (ruf != null) { state.ratings = Array(40).fill(ruf); state.ratingDays = Array(40).fill(state.day); }
  return { ctx, state };
}

test('Bootsdaten: Regeln, Spiel und Werkzeuge kennen dieselben Arten mit Modellen und Gästeprofil', () => {
  for (const t of BOAT_CATALOG.filter((x) => ['S', 'M', 'L', 'XL'].includes(x.size))) {
    assert.ok(Array.isArray(t.wishes), `${t.id} hat wishes`);
    assert.ok(t.feeFactor > 0, `${t.id} hat feeFactor`);
    assert.ok(t.arrivalWeight > 0, `${t.id} hat arrivalWeight`);
    assert.ok(t.models?.length >= 3, `${t.id} hat Modelle`);
  }
});

test('Wünsche je Bootsart: nur aus der eigenen Liste, dazu höchstens ein Angebot', () => {
  const { ctx, state } = neu({ stufe: 6 });
  const angebote = new Set(Object.keys(ctx.rules.offerWishes));
  let mitAngebot = 0;
  for (let i = 0; i < 400; i++) {
    const b = sim.rollBoat(state, ctx);
    if (!b) continue;
    const typ = ctx.typeById[b.typeId];
    const eigene = b.wishes.filter((w) => !angebote.has(w));
    const extra = b.wishes.filter((w) => angebote.has(w));
    for (const w of eigene) assert.ok(typ.wishes.includes(w), `${typ.id} wünscht ${w}`);
    assert.ok(extra.length <= 1);
    for (const w of extra) {
      const o = ctx.rules.offerWishes[w];
      assert.ok(!o.sizes || o.sizes.includes(typ.size), `${w} passt zur Klasse ${typ.size}`);
      assert.ok(!o.sailOnly || typ.sail, `${w} nur für Segler`);
    }
    if (extra.length) mitAngebot++;
  }
  // Anteil etwa wie economy.js (Stufe 6: die Hälfte), mit Spielraum für den Zufall
  assert.ok(mitAngebot > 120 && mitAngebot < 280, `mit Angebotswunsch: ${mitAngebot} von 400`);
});

test('Liegegeld je Art: Grundpreis der Klasse mal feeFactor', () => {
  const { ctx, state } = neu();
  const grund = ctx.rules.baseFee.L;
  const kat = { id: 1, typeId: 'L2', size: 'L' };
  assert.equal(sim.nightlyFee(state, ctx, kat, 0), Math.round(grund * ctx.typeById.L2.feeFactor));
  const yacht = { id: 2, typeId: 'L1', size: 'L' };
  assert.equal(sim.nightlyFee(state, ctx, yacht, 0), Math.round(grund * ctx.typeById.L1.feeFactor));
});

test('Wunsch an ein Angebot: erfüllt, sobald der Service gebaut ist, sonst fehlt er wie eine Dusche', () => {
  for (const gebaut of [false, true]) {
    const { ctx, state } = neu({ stufe: 3, offers: gebaut ? { hafencafe: 1 } : {} });
    const b = sim.rollBoat(state, ctx);
    b.id = state.nextId++;
    b.wishes = ['cafe'];
    b.status = 'waiting';
    b.waitingSince = 0;
    state.boats[b.id] = b;
    state.queue.push(b.id);
    const platz = sim.fittingBerths(state, ctx, b.id)[0];
    assert.ok(platz, 'freier Platz');
    sim.assign(state, ctx, b.id, platz);
    const boot = state.boats[b.id];
    assert.equal(boot.wishesTotal, 1);
    assert.equal(boot.wishesMet, gebaut ? 1 : 0);
    if (!gebaut) assert.equal(boot.missed.cafe, 1);
    const wert = sim.berthValue(state, ctx, b.id, platz);
    assert.deepEqual(wert.wishesMet, gebaut ? ['cafe'] : []);
  }
});

test('Services heben nicht mehr jede Bewertung: die Note kommt aus Wünschen und Platz', () => {
  const { ctx, state } = neu({ offers: { segelclub: 3, hafencafe: 2 } });
  assert.equal(sim.modifiers(state, ctx).ratingBonus, 0);
  const r = ctx.rules.rating;
  assert.equal(sim.rateBoat(ctx, { wishes: ['wc'], wishesMet: 1, wishesTotal: 1, berthId: null }), r.allMet);
  assert.ok(r.allMet < r.max, 'alle Wünsche allein geben noch nicht die volle Note');
  assert.equal(r.noWishes, r.allMet, 'ohne Wünsche wie alle erfüllt (C4)');
});

test('Guter Ruf lockt große Boote, ab 4,5 auch seltene Modelle', () => {
  const zaehle = (ruf) => {
    const { ctx, state } = neu({ stufe: 5, ruf, seed: 11 });
    let gross = 0, selten = 0;
    const rare = new Set(ctx.rules.reputationDraw.rare);
    for (let i = 0; i < 1500; i++) {
      const b = sim.rollBoat(state, ctx);
      if (!b) continue;
      if (b.size === 'L' || b.size === 'XL') gross++;
      if (rare.has(b.modelId)) selten++;
    }
    return { gross, selten };
  };
  const mittel = zaehle(3.5);
  const gut = zaehle(4.2);
  const sehrGut = zaehle(4.8);
  assert.equal(mittel.selten, 0);
  assert.equal(gut.selten, 0);
  assert.ok(sehrGut.selten > 0, 'ab 4,5 kommen seltene Modelle');
  assert.ok(gut.gross > mittel.gross * 1.1, `große Boote: ${mittel.gross} bei 3,5, ${gut.gross} bei 4,2`);
});

test('Angebotswünsche: Text, Bild und Service passen zu economy.js', () => {
  const services = ECONOMY.services;
  for (const [k, w] of Object.entries(ECONOMY.angebotWunsch.wuensche)) {
    assert.ok(services[w.service], `${k}: Service ${w.service} gibt es`);
    assert.ok(w.abStufe >= services[w.service].abStufe, `${k}: erst gewünscht, wenn man ${w.service} bauen kann`);
    assert.equal(ANGEBOT_TEXTE[k]?.service, w.service, `${k}: Text nennt denselben Service`);
    assert.equal(ANGEBOT_BILDER[k]?.raster.length, 12, `${k}: Bild 12 Zeilen`);
    assert.ok(ANGEBOT_BILDER[k].raster.every((z) => z.length === 12), `${k}: Bild 12 Spalten`);
    assert.equal(wunschFuerService(w.service), k);
    assert.ok(WUNSCH_TEXTE[k].saetze.length >= 2);
  }
  assert.deepEqual(Object.keys(ANGEBOT_TEXTE).sort(), Object.keys(ECONOMY.angebotWunsch.wuensche).sort());
});

test('Ruf-Gedächtnis: Spielstand ohne Tage der Bewertungen lädt und rechnet', () => {
  const { ctx, state } = neu({ stufe: 2 });
  delete state.ratingDays;
  state.ratings = [5, 5, 5, 1, 1];
  const r = sim.reputation(state, ctx.rules);
  assert.ok(r >= 1 && r <= 5);
  sim.runDay(state, ctx);
  assert.ok(Array.isArray(state.ratingDays));
  assert.ok(state.ratingDays.length <= state.ratings.length);
});
