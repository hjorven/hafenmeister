// Gästebuch und Bewertungen (Roadmap P14, docs/gaestebuch.md): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { haengeEin } from '../web/js/features/stammgaeste.js';
import * as G from '../web/js/ui/gaestebuch-daten.js';

function neu(seed = 11, stufe = 2) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  haengeEin((n, f) => sim.addHook(ctx, n, f));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  state.office = 3;
  return { ctx, state };
}

function spiele(state, ctx, tage) {
  for (let i = 0; i < tage; i++) {
    G.verarbeite(state, sim.runDay(state, ctx));
    sim.collectAll(state, ctx, true);
  }
}

test('Gästebuch enthält genau die Noten, aus denen der Ruf besteht', () => {
  const { ctx, state } = neu();
  spiele(state, ctx, 40);
  const e = G.buchState(state).eintraege;
  assert.equal(e.length, ctx.rules.reputation.window);
  assert.deepEqual(e.map((x) => x.note), [...state.ratings].reverse());
  const schnitt = e.reduce((a, x) => a + x.note, 0) / e.length;
  assert.ok(Math.abs(schnitt - sim.reputation(state)) < 1e-9);
});

test('jede Abreise erklärt ihre Note: fehlende Wünsche mit Nächten, Pluspunkte', () => {
  const { ctx, state } = neu(5);
  const alle = [];
  for (let i = 0; i < 25; i++) {
    const ev = sim.runDay(state, ctx);
    for (const e of ev.filter((x) => x.type === 'departed')) {
      assert.ok(e.parts, 'departed hat parts');
      assert.equal(e.parts.value, e.rating);
      assert.equal(typeof e.day, 'number');
      for (const [w, n] of Object.entries(e.parts.missed)) assert.ok(e.parts.wishes.includes(w) && n >= 1, w);
    }
    alle.push(...G.verarbeite(state, ev));
    sim.collectAll(state, ctx, true);
  }
  assert.ok(alle.length > 10);
  for (const x of alle) {
    assert.equal(typeof G.satz(x), 'string');
    assert.ok(G.satz(x).length > 5);
    assert.ok(G.absender(x).length > 0);
    if (!G.zufrieden(x) && x.gruende.length) assert.ok(G.hauptgrund(x), 'unzufrieden mit Grund hat Hauptgrund');
    if (G.zufrieden(x)) assert.equal(G.hauptgrund(x), null);
  }
});

test('Note aus Wünschen: wer einen Platz bekam, liegt nie unter einem Abgewiesenen', () => {
  const { ctx } = neu();
  const r = ctx.rules.rating;
  assert.ok(r.noneMet >= ctx.rules.turnAway.rating);
  assert.equal(sim.rateBoat(ctx, { wishes: ['wc'], wishesMet: 1, wishesTotal: 1, berthId: null, penalty: 0 }), r.allMet);
  assert.equal(sim.rateBoat(ctx, { wishes: ['wc'], wishesMet: 0, wishesTotal: 1, berthId: null, penalty: 0 }), r.noneMet);
  assert.equal(sim.rateBoat(ctx, {}), r.noWishes);
});

test('häufigste Gründe zählen nur unzufriedene Gäste, je Gast einmal', () => {
  const state = createState({ seed: 1 });
  const e = (id, note, missed) => ({ type: 'departed', boatId: id, rating: note, berthId: 'A01', day: 1,
    parts: { wishes: Object.keys(missed), wishesTotal: 1, missed, penalty: 0, bonus: 0, comfort: 0, special: 0 } });
  G.verarbeite(state, [e(1, 2.5, { dusche: 3 }), e(2, 3, { dusche: 1, wc: 1 }), e(3, 4.5, { wc: 1 }), e(4, 3.5, { essen: 1 })]);
  const top = G.topGruende(state);
  assert.deepEqual(top[0], { key: 'dusche', gaeste: 2 });
  assert.equal(top.find((t) => t.key === 'wc').gaeste, 1);   // der Zufriedene zählt nicht
  assert.equal(top.length, 3);
});

test('Abgewiesene und Weggeschickte mit Note stehen im Gästebuch', () => {
  const state = createState({ seed: 1 });
  G.verarbeite(state, [
    { type: 'turnedAway', boatId: 7, reason: 'patience', rated: true, rating: 2.5, day: 2, guest: { name: 'Jolle', bootsname: 'Möwe', heimathafen: 'Kappeln' } },
    { type: 'turnedAway', boatId: 8, reason: 'queueFull', rated: false },
    { type: 'dismissed', boatId: 9, rated: true, rating: 2.5, day: 2, guest: { name: 'Kutter' } },
  ]);
  const e = G.buchState(state).eintraege;
  assert.equal(e.length, 2);
  assert.equal(e[1].gruende[0].key, 'warten');
  assert.equal(e[0].gruende[0].key, 'weggeschickt');
  assert.equal(G.hauptgrund(e[0]), 'weggeschickt');
  assert.equal(G.absender(e[1]), '„Möwe“ aus Kappeln');
  assert.equal(G.absender(e[0]), 'Gäste mit Kutter');
});

test('Umbau: Satz nennt die Baustelle, Symbol ist der Umbau', () => {
  const state = createState({ seed: 1 });
  const [x] = G.verarbeite(state, [{ type: 'departed', boatId: 3, rating: 3, reason: 'rebuild', berthId: 'A01', day: 4,
    parts: { wishes: ['dusche'], wishesTotal: 1, missed: { dusche: 1 }, penalty: 0, bonus: 0, comfort: 0, special: 0 } }]);
  assert.equal(x.art, 'umbau');
  assert.equal(G.hauptgrund(x), 'umbau');
  assert.match(G.satz(x), /Bau/);
});

test('Ruf-Verlauf: ein Wert je Tag, höchstens 30 Tage, heute angehängt', () => {
  const { ctx, state } = neu(3);
  spiele(state, ctx, 35);
  const v = G.buchState(state).verlauf;
  assert.equal(v.length, G.GAESTEBUCH.maxVerlauf);
  for (let i = 1; i < v.length; i++) assert.equal(v[i].tag, v[i - 1].tag + 1);
  const mitHeute = G.verlauf(state);
  assert.ok(mitHeute[mitHeute.length - 1].heute);
  assert.ok(mitHeute.length <= G.GAESTEBUCH.maxVerlauf);
});

test('Speichern und Laden behält Gästebuch und Verlauf; alter Spielstand ohne Daten geht', () => {
  const { ctx, state } = neu(9);
  spiele(state, ctx, 6);
  const geladen = deserialize(JSON.stringify(state));
  assert.deepEqual(G.buchState(geladen), G.buchState(state));
  const alt = createState({ seed: 2 });
  delete alt.modules.gaestebuch;
  assert.deepEqual(G.topGruende(alt), []);
  assert.equal(G.zusammenfassung(alt).anzahl, 0);
  assert.ok(G.eintragen(alt, { type: 'departed', boatId: 1, rating: 4, berthId: 'A01' }));
});

test('gleiche Seite, gleicher Text: Sätze hängen nicht am Würfel der Spielregeln', () => {
  const state = createState({ seed: 1 });
  const ev = { type: 'departed', boatId: 42, rating: 5, berthId: 'A01', day: 3, parts: { wishes: ['wc'], wishesTotal: 1, missed: {}, penalty: 0, bonus: 0, comfort: 0, special: 0 } };
  const [a] = G.verarbeite(state, [ev]);
  const vorher = state.seed;
  assert.equal(G.satz(a), G.satz({ ...a }));
  assert.equal(state.seed, vorher);
});
