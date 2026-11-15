// Statistik und Saisonbilanz (features/statistik-daten.js, ui/statistik.js, docs/statistik.md, P41).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as st from '../web/js/features/statistik-daten.js';
import { saisonBilanz } from '../web/js/features/winter.js';
import { hinweis } from '../web/js/ui/statistik.js';

function neu({ stage = 2, seed = 5 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stage);
  st.haengeEin((name, fn) => sim.addHook(ctx, name, fn));
  return { ctx, state };
}

test('Jede Nacht wird die Belegung gemerkt, höchstens 30 Nächte', () => {
  const { ctx, state } = neu();
  for (let i = 0; i < 35; i++) sim.runDay(state, ctx);
  const n = state.modules.statistik.nacht;
  assert.equal(n.length, st.NACHT_MAX);
  assert.equal(n.at(-1).tag, 35);
  const plaetze = sim.availableBerths(state, ctx).filter((b) => !b.reserved).length;
  for (const x of n) {
    assert.ok(x.plaetze > 0 && x.plaetze <= plaetze, JSON.stringify(x));
    assert.ok(x.gaeste >= 0 && x.dauer >= 0);
  }
  // In der Saison lag nachts jemand
  assert.ok(n.some((x) => x.gaeste > 0), 'nie ein Gast über Nacht');
});

test('Belegung zählt die heute Abgereisten mit, Fischerplätze nicht', () => {
  const { ctx, state } = neu();
  sim.runDay(state, ctx);
  sim.runDay(state, ctx);
  const v = state.stats.verlauf.at(-1);
  const n = state.modules.statistik.nacht.find((x) => x.tag === v.tag);
  assert.equal(n.gaeste, v.liegend + v.abgereist);
  const b = st.belegungTag(state, v);
  assert.equal(b.geschaetzt, false);
  assert.ok(b.anteil >= 0 && b.anteil <= 1);
  assert.equal(n.plaetze, sim.availableBerths(state, ctx).filter((x) => !x.reserved).length);
});

test('Saison wird in der Nacht des letzten Saisontags gemerkt und bleibt den ganzen Winter vollständig', () => {
  const { ctx, state } = neu();
  const S = ctx.rules.seasonDays;
  while (state.day <= S) sim.runDay(state, ctx);
  const gemerkt = state.modules.statistik.saisons;
  assert.equal(gemerkt.length, 1);
  assert.equal(gemerkt[0].jahr, 1);
  assert.equal(gemerkt[0].tage, S);
  const summe = state.stats.verlauf.filter((t) => t.tag <= S).reduce((a, t) => a + t.summe, 0);
  assert.equal(gemerkt[0].einnahmen, summe);
  // Quellen ergeben zusammen die Einnahmen (Geschenke zählen nicht)
  assert.equal(Object.values(gemerkt[0].quellen).reduce((a, x) => a + x, 0), summe);
  assert.ok(gemerkt[0].belegung > 0 && gemerkt[0].belegung <= 1);
  // Letzter Wintertag: die Bilanz bleibt vollständig, auch wenn der Verlauf Tag 1 schon verloren hätte
  while (sim.season(state, ctx).winter || state.day <= S) {
    const sea = sim.season(state, ctx);
    if (sea.winter && sea.day === S + ctx.rules.winterDays) break;
    sim.runDay(state, ctx);
  }
  assert.ok(sim.season(state, ctx).winter);
  const b = saisonBilanz(state, ctx);
  assert.equal(b.jahr, 1);
  assert.equal(b.tage, S);
  assert.equal(b.einnahmen, summe);
});

test('Zweite Saison: Vergleich zur ersten, Liste neueste zuerst', () => {
  const { ctx, state } = neu();
  const LEN = ctx.rules.seasonDays + ctx.rules.winterDays;
  while (state.day <= LEN + ctx.rules.seasonDays) sim.runDay(state, ctx);
  const alle = st.saisons(state);
  assert.deepEqual(alle.map((s) => s.jahr), [2, 1]);
  const p = st.vergleich(alle[0].einnahmen, alle[1].einnahmen);
  assert.equal(typeof p, 'number');
  assert.equal(st.vergleich(100, 0), null);
  assert.equal(st.vergleich(150, 100), 50);
  assert.equal(st.vergleich(50, 100), -50);
});

test('Tage, Quellen und Kennzahlen aus dem Verlauf; Geschenk zählt nicht, Winter nicht im Schnitt', () => {
  const { ctx, state } = neu();
  const S = ctx.rules.seasonDays;
  state.day = S + 2;
  state.stats.verlauf = [
    { tag: S - 1, summe: 100, einnahmen: { liegegeld: 80, pacht: 20 }, ausgabenSumme: 0, angelegt: 3, abgereist: 2, liegend: 4, plaetze: 10, weggefahrenSumme: 1 },
    { tag: S, summe: 200, einnahmen: { liegegeld: 150, sonstiges: 90 }, geschenkt: 40, ausgabenSumme: 30, angelegt: 4, abgereist: 3, liegend: 7, plaetze: 10, weggefahrenSumme: 0 },
    { tag: S + 1, summe: 10, einnahmen: { pacht: 10 }, ausgabenSumme: 0, angelegt: 0, abgereist: 0, liegend: 0, plaetze: 10, weggefahrenSumme: 0 },
  ];
  const t = st.tage(state, ctx);
  assert.deepEqual(t.map((x) => x.summe), [100, 200, 10]);
  assert.deepEqual(t[1].quellen, { liegegeld: 150, sonstiges: 50 });
  assert.equal(t[2].winter, true);
  assert.equal(t[0].belegung.geschaetzt, true);
  assert.equal(t[0].belegung.anteil, 0.6);
  const q = st.quellenSumme(t);
  assert.deepEqual(q.map((x) => x.id), ['liegegeld', 'sonstiges', 'pacht']);
  assert.equal(q[0].summe, 230);
  assert.ok(Math.abs(q.reduce((a, x) => a + x.anteil, 0) - 1) < 1e-9);
  const z = st.zusammenfassung(t);
  assert.equal(z.summe, 310);
  assert.equal(z.schnitt, 150);            // nur die beiden Saisontage
  assert.deepEqual(z.besterTag, { tag: S, summe: 200 });
  assert.equal(z.belegung, (0.6 + 1) / 2);
  assert.equal(z.volleNaechte, 1);
  assert.equal(z.weggefahren, 1);
  assert.equal(z.winterTage, 1);
  assert.equal(z.geschaetzt, true);
});

test('Laufender Tag kommt als letzter dazu, mit Belegung von jetzt', () => {
  const { ctx, state } = neu();
  sim.runDay(state, ctx);
  sim.tick(state, ctx, ctx.rules.dayLength * 0.6);
  const t = st.tage(state, ctx, { heute: sim.tagesbericht(state, ctx) });
  assert.equal(t.at(-1).laufend, true);
  assert.equal(t.at(-1).tag, state.day);
  assert.ok(t.at(-1).belegung.plaetze > 0);
  // Ohne Verlauf: nur der laufende Tag
  const n = neu();
  const t2 = st.tage(n.state, n.ctx, { heute: sim.tagesbericht(n.state, n.ctx) });
  assert.equal(t2.length, 1);
  assert.equal(st.zusammenfassung(t2).tage, 0);
  assert.equal(st.tage(n.state, n.ctx).length, 0);
});

test('Kaputter oder alter Spielstand: Statistik wird still angelegt, Saisons begrenzt', () => {
  const { ctx, state } = neu();
  state.modules.statistik = 'kaputt';
  assert.deepEqual(st.statistikState(state), { nacht: [], saisons: [] });
  state.modules.statistik = { nacht: [null, 3, { tag: 'x' }], saisons: 'nein' };
  sim.runDay(state, ctx);
  assert.ok(state.modules.statistik.nacht.every((x) => x && Number.isInteger(x.tag)));
  assert.deepEqual(state.modules.statistik.saisons, []);
  // Viele Saisons: höchstens SAISONS_MAX bleiben, die neuesten
  const LEN = ctx.rules.seasonDays + ctx.rules.winterDays;
  for (let j = 1; j <= st.SAISONS_MAX + 5; j++) {
    state.stats.verlauf = [{ tag: (j - 1) * LEN + 1, summe: j, einnahmen: { liegegeld: j }, abgereist: 0 }];
    st.saisonMerken(state, ctx, null, j);
  }
  const s = st.saisons(state);
  assert.equal(s.length, st.SAISONS_MAX);
  assert.equal(s[0].jahr, st.SAISONS_MAX + 5);
  assert.equal(s.at(-1).jahr, 6);
  // Saison ohne Tage wird nicht gemerkt
  state.stats.verlauf = [];
  assert.equal(st.saisonMerken(state, ctx, null, 99), null);
});

test('Spielstand übersteht Speichern und Laden (JSON)', () => {
  const { ctx, state } = neu();
  for (let i = 0; i < 5; i++) sim.runDay(state, ctx);
  const kopie = JSON.parse(JSON.stringify(state));
  assert.deepEqual(st.tage(kopie, ctx), st.tage(state, ctx));
});

test('Hinweis: volle Nächte, weitergefahrene Boote, leerer Hafen, sonst nichts', () => {
  assert.equal(hinweis(null), null);
  assert.equal(hinweis({ tage: 2, volleNaechte: 9 }), null);
  assert.match(hinweis({ tage: 10, volleNaechte: 6, weggefahren: 0, angelegt: 10, belegung: 0.9 }), /6 Nächten/);
  assert.match(hinweis({ tage: 10, volleNaechte: 1, weggefahren: 8, angelegt: 20, belegung: 0.8 }), /8 Boote/);
  assert.match(hinweis({ tage: 10, volleNaechte: 0, weggefahren: 0, angelegt: 20, belegung: 0.2 }), /leer/);
  assert.equal(hinweis({ tage: 10, volleNaechte: 0, weggefahren: 1, angelegt: 20, belegung: 0.7 }), null);
});
