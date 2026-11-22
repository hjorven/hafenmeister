// Wind im Hafen (P34, F5 und F35): Richtung je Tag, Windlage je Platz, Bewertung, Platzwahl.
// Ohne Browser, mit den echten Zahlen aus economy.js. Beschreibung: docs/wind.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { windRichtung, richtungsName, windRaster, wellenweg, windLage, bugGegenWind, platzLagen } from '../web/js/world/wind.js';
import { windTick, windScore, platzZeichen, anlegeTempo, lageZaehlt } from '../web/js/features/wind-regeln.js';
import { gruendeAusAbreise } from '../web/js/ui/gaestebuch-daten.js';
import { createScheduler } from '../web/js/events/scheduler.js';

const W = ECONOMY.wind;

function neu({ seed = 3, stufe = 3 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  ctx.rules.queue.selfEnterAfter = null;
  ctx.rules.queue.buoyFee = 0;
  ctx.rules.trips = null;
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  state.testmodus = false;
  sim.tick(state, ctx, 0);
  state.upcoming = [];
  return { ctx, state };
}
let naechste = 9000;
function lege(state, ctx, platz, extra = {}) {
  const id = naechste++;
  const b = { id, typeId: 'M1', modelId: null, name: 'Gast', size: 'M', length: 9, beam: 3.1, draft: 1.5, motor: false, special: false,
    dayVisitors: 0, stationed: false, wishes: [], nights: 2, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
    berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...extra };
  state.boats[id] = b;
  state.queue.push(id);
  const r = sim.assign(state, ctx, id, platz);
  assert.ok(r.ok, `passt an ${platz}: ${r.reason}`);
  return b;
}
const freieBox = (state, ctx, boot, n = 0) => sim.availableBerths(state, ctx)
  .filter((b) => b.kind === 'box' && sim.isFree(state, b.id) && sim.fits(boot, b, ctx.rules, state.stage))[n].id;

// ------------------------------------------------------------------ Richtung

test('Windrichtung: fest aus Seed und Tag, eine Wetterlage hält mehrere Tage', () => {
  for (let tag = 1; tag < 60; tag++) assert.equal(windRichtung(7, tag, W), windRichtung(7, tag, W));
  // innerhalb einer Wetterlage höchstens zweimal die Streuung auseinander
  for (let p = 0; p < 30; p++) {
    const tage = Array.from({ length: W.wetterlageTage }, (_, i) => windRichtung(5, p * W.wetterlageTage + 1 + i, W));
    for (const a of tage) for (const b of tage) {
      const d = Math.abs(((a - b + 540) % 360) - 180);
      assert.ok(d <= 2 * W.streuung + 1, `Wetterlage ${p}: ${tage.join(', ')}`);
    }
  }
});

test('Windrichtung: meist aus West bis Südwest, Sturm aus West bis Nordwest', () => {
  const zaehl = {};
  for (let s = 1; s <= 40; s++) for (let tag = 1; tag <= 90; tag += W.wetterlageTage) {
    const n = richtungsName(windRichtung(s, tag, W));
    zaehl[n] = (zaehl[n] || 0) + 1;
  }
  const summe = Object.values(zaehl).reduce((a, b) => a + b, 0);
  const west = ((zaehl.West || 0) + (zaehl['Südwest'] || 0) + (zaehl.Nordwest || 0)) / summe;
  assert.ok(west > 0.45 && west < 0.8, `Westanteil ${west}`);
  assert.ok((zaehl.Ost || 0) > 0, 'auch mal Ostwind');
  for (let s = 1; s < 30; s++) {
    const g = windRichtung(s, 10, W, 'sturm');
    assert.ok(g >= 135 - W.streuung - 1 && g <= 180 + W.streuung + 1, `Sturm aus ${g}`);
  }
});

test('Wetter des Tages trägt die Richtung, auch an Ereignis- und Wintertagen', () => {
  const s = createScheduler({ seed: 11 });
  for (let d = 1; d < 120; d++) {
    const wx = s.weather(d);
    assert.ok(Number.isFinite(wx.richtung) && wx.richtung >= 0 && wx.richtung < 360, `Tag ${d}: ${wx.richtung}`);
  }
  assert.equal(richtungsName(180), 'West');
  assert.equal(richtungsName(225), 'Südwest');
  assert.equal(richtungsName(359), 'Ost');
});

// ------------------------------------------------------------------ Windlage

// Kleine Welt: Land westlich von x = 0, ein Schwimmsteg bei x = 40, eine Mole bei x = 80
const BEREICH = { x0: -50, x1: 400, z0: -100, z1: 100 };
const welt = (o = {}) => windRaster({ bereich: BEREICH, zelle: 2, istLand: (x) => x < 0, ...o });

test('Wellenweg: Wind vom Land her ist kurz, von See her lang', () => {
  const r = welt();
  const vomLand = wellenweg(r, 20, 0, 180, W);   // Wind aus West, Land 20 m westlich
  const vonSee = wellenweg(r, 20, 0, 0, W);      // Wind aus Ost, freie See
  assert.ok(vomLand <= 22, `vom Land ${vomLand}`);
  assert.equal(windLage(vomLand, W), 'geschuetzt');
  assert.ok(vonSee >= 250, `von See ${vonSee}`);
  assert.equal(windLage(vonSee, W), 'offen');
});

test('Wellenweg: Schwimmsteg dämpft nur, Mole und Kai halten ab', () => {
  const steg = [{ punkte: [{ x: 60, z: -90 }, { x: 60, z: 90 }], breite: 2 }];
  const ohne = wellenweg(welt(), 30, 0, 0, W);
  const mitSteg = wellenweg(welt({ stege: steg }), 30, 0, 0, W);
  const mitMole = wellenweg(welt({ hart: steg }), 30, 0, 0, W);
  assert.ok(mitSteg < ohne && mitSteg > ohne * 0.4, `Steg ${mitSteg} gegen ${ohne}`);
  assert.ok(mitMole <= 32, `Mole ${mitMole}`);
  // Platz direkt an der Kaimauer: die Mauer unter dem Platz zählt nicht als Schutz von See
  const kai = [{ punkte: [{ x: 100, z: -90 }, { x: 100, z: 90 }], breite: 3 }];
  assert.ok(wellenweg(welt({ hart: kai }), 101, 0, 0, W) > 200);
});

test('Lagen aller Plätze und Bug zum Wind', () => {
  const l = platzLagen(welt(), [{ id: 'a', x: 10, z: 0 }, { id: 'b', x: 200, z: 0 }], 0, W);
  assert.equal(l.get('a').lage, 'offen');
  const l2 = platzLagen(welt(), [{ id: 'a', x: 10, z: 0 }], 180, W);
  assert.equal(l2.get('a').lage, 'geschuetzt');
  assert.ok(Math.abs(bugGegenWind(180, 180) - 1) < 1e-9);
  assert.ok(Math.abs(bugGegenWind(0, 180) + 1) < 1e-9);
  assert.ok(Math.abs(bugGegenWind(90, 180)) < 1e-9);
});

// ------------------------------------------------------------------ Regeln

const STARK = { wind: 0.8, richtung: 180, event: null };
const RUHIG = { wind: 0.3, richtung: 180, event: null };

test('Starkwind: offener Platz kostet, geschützter bringt Anker; Gästebuch nennt den Grund', () => {
  const { ctx, state } = neu();
  const probe = { size: 'M', length: 9, beam: 3.1, draft: 1.5 };
  const a = lege(state, ctx, freieBox(state, ctx, probe, 0));
  const b = lege(state, ctx, freieBox(state, ctx, probe, 0));
  const lage = (id) => (id === a.berthId ? 'offen' : id === b.berthId ? 'geschuetzt' : 'normal');
  const vorA = sim.ratingParts(ctx, a).value, vorB = sim.ratingParts(ctx, b).value;
  windTick(state, ctx, STARK, lage, () => 0);
  assert.equal(a.windLage, 'offen');
  assert.equal(b.windLage, 'geschuetzt');
  const pa = sim.ratingParts(ctx, a), pb = sim.ratingParts(ctx, b);
  assert.equal(pa.wind, -W.unruhig);
  assert.equal(pb.wind, W.geschuetzt);
  assert.ok(pa.value < vorA || vorA === 1);
  assert.ok(pb.value > vorB || vorB === 5);
  const ga = gruendeAusAbreise({ parts: pa });
  assert.ok(ga.gruende.some((g) => g.key === 'unruhig'));
  const gb = gruendeAusAbreise({ parts: pb });
  assert.ok(gb.plus.some((p) => p.key === 'windgeschuetzt'));
});

test('Kein Starkwind, Badesteg oder Sturmtag: Windlage zählt nicht', () => {
  const { ctx, state } = neu();
  const probe = { size: 'M', length: 9, beam: 3.1, draft: 1.5 };
  const a = lege(state, ctx, freieBox(state, ctx, probe));
  windTick(state, ctx, RUHIG, () => 'offen', () => 0);
  assert.equal(a.windLage, undefined);
  windTick(state, ctx, { ...STARK, event: 'sturm' }, () => 'offen', () => 0);
  assert.equal(a.windLage, undefined, 'am Sturmtag gilt das Sturm-Ereignis');
  const s1 = neu({ stufe: 1 });
  const c = lege(s1.state, s1.ctx, freieBox(s1.state, s1.ctx, { size: 'S', length: 5, beam: 2, draft: 0.8 }), { size: 'S', length: 5, beam: 2, draft: 0.8, typeId: 'S1' });
  windTick(s1.state, s1.ctx, STARK, () => 'offen', () => 0);
  assert.equal(c.windLage, undefined, 'am Badesteg (Stufe 1) noch nicht');
  assert.equal(lageZaehlt(s1.state, STARK, s1.ctx.rules), false);
});

test('Verholen bei Starkwind: die letzte Lage zählt', () => {
  const { ctx, state } = neu();
  const probe = { size: 'M', length: 9, beam: 3.1, draft: 1.5 };
  const a = lege(state, ctx, freieBox(state, ctx, probe));
  const erst = a.berthId;
  windTick(state, ctx, STARK, (id) => (id === erst ? 'offen' : 'normal'), () => 0);
  assert.equal(a.windLage, 'offen');
  const ziel = freieBox(state, ctx, probe);
  const r = sim.relocateGuest(state, ctx, a.id, ziel);
  assert.ok(r.ok, r.reason);
  windTick(state, ctx, STARK, (id) => (id === erst ? 'offen' : 'normal'), () => 0);
  assert.equal(a.windLage, null);
  assert.equal(sim.ratingParts(ctx, a).wind, 0);
});

test('Große Boote: Rückenwind beim Anlegen kostet, Bug gegen den Wind nicht', () => {
  const { ctx, state } = neu({ stufe: 4 });
  const gross = { size: 'L', length: 12, beam: 3.9, draft: 1.9, typeId: 'L1' };
  const p1 = freieBox(state, ctx, gross, 0);
  const a = lege(state, ctx, p1, gross);
  windTick(state, ctx, STARK, () => 'normal', () => -0.9);
  assert.equal(a.windRuecken, true);
  assert.equal(sim.ratingParts(ctx, a).wind, -W.rueckenwind);
  const b = lege(state, ctx, freieBox(state, ctx, gross, 0), gross);
  windTick(state, ctx, STARK, () => 'normal', () => 0.9);
  assert.ok(!b.windRuecken);
  // kleine Boote kümmert der Rückenwind nicht
  const m = lege(state, ctx, freieBox(state, ctx, { size: 'M', length: 9, beam: 3.1, draft: 1.5 }));
  windTick(state, ctx, STARK, () => 'normal', () => -1);
  assert.ok(!m.windRuecken);
  // Tempo beim Anlegen
  assert.equal(anlegeTempo(W, true, 'L', 1), 1);
  assert.equal(anlegeTempo(W, true, 'L', -1), W.anlegenTempo);
  assert.equal(anlegeTempo(W, false, 'L', -1), 1);
  assert.equal(anlegeTempo(W, true, 'M', -1), 1);
  const mitte = anlegeTempo(W, true, 'XL', 0);
  assert.ok(mitte < 1 && mitte > W.anlegenTempo);
});

test('Platzwahl bei Starkwind: Büro und Einfahren lassen nehmen den geschützten Platz', () => {
  const { ctx, state } = neu();
  const probe = { size: 'M', length: 9, beam: 3.1, draft: 1.5 };
  const id = naechste++;
  state.boats[id] = { id, typeId: 'M1', name: 'Gast', size: 'M', length: 9, beam: 3.1, draft: 1.5, wishes: [], nights: 1, status: 'waiting', atBuoy: true, berthId: null, wishesMet: 0, wishesTotal: 0, penalty: 0 };
  state.queue.push(id);
  const vorher = sim.fittingBerths(state, ctx, id);
  assert.ok(vorher.length >= 3);
  const schutz = vorher[1];
  const heute = { ...STARK };
  sim.addHook(ctx, 'score', ({ state: s, ctx: c, boat, berth }) => windScore(s, c, boat, berth, heute, (b) => (b === schutz ? 'geschuetzt' : b === vorher[0] ? 'offen' : 'normal'), () => 0));
  const nachher = sim.fittingBerths(state, ctx, id);
  assert.equal(nachher[0], schutz, 'geschützter Platz zuerst');
  assert.notEqual(nachher[0], vorher[0]);
  heute.wind = 0.2;
  assert.deepEqual(sim.fittingBerths(state, ctx, id), vorher, 'ohne Starkwind wie vorher');
  void probe;
});

test('Zeichen über den Boxen: Rückenwind für große Boote geht vor, ohne Starkwind keins', () => {
  const { ctx, state } = neu();
  const lage = () => 'geschuetzt';
  assert.equal(platzZeichen(state, ctx.rules, STARK, { size: 'M' }, 'x', lage, () => -1), 'geschuetzt');
  assert.equal(platzZeichen(state, ctx.rules, STARK, { size: 'L' }, 'x', lage, () => -1), 'rueckenwind');
  assert.equal(platzZeichen(state, ctx.rules, STARK, { size: 'L' }, 'x', lage, () => 1), 'geschuetzt');
  assert.equal(platzZeichen(state, ctx.rules, RUHIG, { size: 'L' }, 'x', lage, () => -1), null);
  assert.equal(platzZeichen(state, ctx.rules, STARK, { size: 'M' }, 'x', () => 'normal', () => 0), null);
});
