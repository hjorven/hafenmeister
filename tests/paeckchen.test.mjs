// Päckchen liegen (P27, F1): Regeln ohne Browser, mit den echten Zahlen aus economy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { sturmklar } from '../web/js/events/vorbereiten.js';

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

let naechste = 7000;
function boot(state, extra = {}) {
  const id = naechste++;
  const b = { id, typeId: 'M1', modelId: null, name: 'Gast', size: 'M', length: 9, beam: 3.1, draft: 1.5, motor: false, special: false,
    dayVisitors: 0, stationed: false, wishes: [], nights: 3, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
    berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...extra };
  state.boats[id] = b;
  state.queue.push(id);
  return b;
}
function lege(state, ctx, platz, extra = {}) {
  const b = boot(state, extra);
  const r = sim.assign(state, ctx, b.id, platz);
  assert.ok(r.ok, `passt an ${platz}: ${r.reason}`);
  return b;
}
// Alle freien Gastplätze mit großen Platzhaltern belegen (so ist für M-Boote keine Box mehr frei)
function fuelle(state, ctx, ausser = []) {
  for (const b of sim.availableBerths(state, ctx)) {
    if (b.reserved || !sim.isFree(state, b.id) || ausser.includes(b.id)) continue;
    const id = naechste++;
    state.boats[id] = { id, typeId: 'S1', size: b.size, length: Math.min(b.maxLength, 6), beam: 2, draft: 0.5, stationed: false, wishes: [], nights: 5,
      status: 'moored', berthId: b.id, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, paid: true, feeDay: state.day, paidThrough: state.day + 5 };
    state.berths[b.id] = id;
  }
}
const stirn = (state, ctx) => sim.availableBerths(state, ctx).filter((b) => b.kind === 'stirn').map((b) => b.id);

test('Päckchenplätze stehen in berthById, nicht in der Platzliste', () => {
  const { ctx, state } = neu();
  assert.ok(ctx.berthById['B27+'], 'Stirnplatz hat einen Päckchenplatz');
  assert.equal(ctx.berthById['B27+'].raft, 'B27');
  assert.ok(!ctx.berths.some((b) => b.id.endsWith('+')), 'nicht in ctx.berths');
  assert.ok(!sim.availableBerths(state, ctx).some((b) => b.raft));
  assert.equal(ctx.berthById['A01+'], undefined, 'Boxen haben keinen Päckchenplatz');
  assert.ok(ctx.berthById['K01+'], 'Kai hat einen');
  assert.equal(ctx.berthById['F02+'], undefined, 'Fischerplätze nicht');
  assert.ok(!sim.berthStates(state, ctx).some?.((p) => String(p.id ?? p).endsWith('+')));
});

test('Päckchen nur, wenn keine passende Box frei ist, und nur an gleich große oder größere Boote', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6 });
  const gast = boot(state);
  assert.deepEqual(sim.raftTargets(state, ctx, gast.id), [], 'Boxen frei: kein Päckchen');
  assert.equal(sim.raftWhyNot(state, ctx, gast, s1 + '+'), 'boxFree');
  fuelle(state, ctx);
  assert.deepEqual(sim.fittingBerths(state, ctx, gast.id), []);
  assert.ok(sim.raftTargets(state, ctx, gast.id).includes(s1 + '+'));
  // größer als das Boot innen: nein
  const gross = boot(state, { length: 12, beam: 3.8 });
  assert.equal(sim.raftWhyNot(state, ctx, gross, s1 + '+'), 'bigger');
  const klasseL = boot(state, { size: 'L', length: 10.5 });
  assert.equal(sim.raftWhyNot(state, ctx, klasseL, s1 + '+'), 'bigger');
  // gleich groß (bis laengeMehr länger) geht
  const gleich = boot(state, { length: 11.4 });
  assert.equal(sim.raftWhyNot(state, ctx, gleich, s1 + '+'), null);
  assert.equal(innen.paeckchenInnen, undefined);
});

test('Anlegen im Päckchen: halbes Liegegeld, höchstens eine Nacht, beide Crews einen halben Anker weniger', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const gast = boot(state, { nights: 3 });
  const voll = sim.nightlyFee(state, ctx, gast, 0, sim.modifiers(state, ctx).priceFactor);
  const wert = sim.berthValue(state, ctx, gast.id, s1 + '+');
  assert.equal(wert.paeckchen, s1);
  assert.equal(wert.malus, ECONOMY.paeckchen.ruf);
  const r = sim.assign(state, ctx, gast.id, s1 + '+');
  assert.ok(r.ok, r.reason);
  const ev = r.events.find((e) => e.type === 'moored');
  assert.equal(ev.paeckchen, s1);
  assert.equal(ev.innen, innen.id);
  assert.equal(state.berths[s1 + '+'], gast.id);
  assert.equal(gast.berthId, s1 + '+');
  assert.equal(gast.nights, 1, 'außen höchstens eine Nacht');
  const fee = r.events.find((e) => e.type === 'feeReady');
  assert.equal(fee.amount, Math.round(voll * ECONOMY.paeckchen.liegegeld));
  assert.equal(wert.fee, fee.amount, 'Schild zeigt denselben Betrag');
  assert.ok(innen.paeckchenInnen);
  const ohne = sim.ratingParts(ctx, { ...gast, paeckchen: null }).value;
  assert.equal(sim.ratingParts(ctx, gast).paeckchen, 0.5);
  assert.equal(Math.round((ohne - sim.ratingParts(ctx, gast).value) * 10) / 10, 0.5);
  assert.equal(sim.ratingParts(ctx, innen).paeckchen, 0.5);
  // ein zweites Boot passt nicht außen an das äußere
  assert.equal(ctx.berthById[s1 + '++'], undefined);
  const dritter = boot(state, { length: 8 });
  assert.equal(sim.raftWhyNot(state, ctx, dritter, s1 + '+'), 'occupied');
});

test('Inneres Boot: kein Umlegen und kein Tagestörn, solange außen jemand liegt; außen verholen hebt den Abzug auf', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const gast = lege(state, ctx, s1 + '+');
  assert.ok(sim.raftBlocked(state, s1));
  assert.equal(sim.canRelocate(state, innen.id), false);
  // eine Box wird frei
  const frei = sim.availableBerths(state, ctx).find((b) => b.kind === 'box' && sim.fits(gast, b, ctx.rules, state.stage));
  const alt = state.berths[frei.id];
  delete state.boats[alt];
  delete state.berths[frei.id];
  assert.equal(sim.relocateGuest(state, ctx, innen.id, frei.id).reason, 'raftOuter');
  assert.ok(sim.canRelocate(state, gast.id));
  assert.ok(sim.relocateTargets(state, ctx, gast.id).includes(frei.id));
  const r = sim.relocateGuest(state, ctx, gast.id, frei.id);
  assert.ok(r.ok, r.reason);
  assert.equal(r.events[0].ausPaeckchen, s1);
  assert.equal(gast.paeckchen, null);
  assert.equal(gast.umgelegt ?? 0, 0, 'aus dem Päckchen verholen zählt nicht als Umlegen');
  assert.equal(sim.ratingParts(ctx, gast).paeckchen, 0);
  assert.equal(state.berths[s1 + '+'], undefined);
  assert.ok(sim.canRelocate(state, innen.id));
});

test('Abreise: außen legt vor innen ab, reist innen ab, reist außen mit', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6, nights: 1 });
  fuelle(state, ctx);
  const gast = lege(state, ctx, s1 + '+', { nights: 1 });
  const ev = sim.runDay(state, ctx);
  const ab = ev.filter((e) => e.type === 'departed').map((e) => e.boatId);
  assert.ok(ab.includes(innen.id) && ab.includes(gast.id));
  const li = state.leaving[s1], la = state.leaving[s1 + '+'];
  assert.ok(li && la);
  assert.ok(li.at >= la.at + 20, `innen ${li.at} nach außen ${la.at}`);
});

test('Außen bleibt nie länger als innen: reist innen ab, reist außen mit ab', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  lege(state, ctx, s1, { length: 11, beam: 3.6, nights: 1 });
  fuelle(state, ctx);
  const gast = lege(state, ctx, s1 + '+');
  gast.nights = 4;   // zum Beispiel aus einem Modul verlängert
  sim.runDay(state, ctx);
  assert.equal(state.boats[gast.id], undefined, 'außen ist mit abgereist');
});

test('Innen bleibt, außen reist ab: Tagestörn erst, wenn außen weg ist', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6, nights: 4 });
  fuelle(state, ctx);
  lege(state, ctx, s1 + '+', { nights: 1 });
  sim.runDay(state, ctx);
  assert.ok(state.leaving[s1 + '+'], 'außen legt am Vormittag ab');
  assert.ok(sim.raftBlocked(state, s1));
  innen.trip = { out: 0, back: 1e9, away: false };
  const ev = sim.tick(state, ctx, 1);
  assert.ok(!ev.some((e) => e.type === 'tripOut'), 'wartet auf außen');
  sim.berthCleared(state, ctx, { berthId: s1 + '+' });
  const ev2 = sim.tick(state, ctx, 1);
  assert.ok(ev2.some((e) => e.type === 'tripOut' && e.boatId === innen.id));
});

test('Kein Päckchen an Kurzhalter, Fischer, Boote auf Tagestörn oder unter Stufe 2', () => {
  const { ctx, state } = neu();
  const [s1, s2] = stirn(state, ctx);
  lege(state, ctx, s1, { length: 11, beam: 3.6, nights: 0, stay: 0.3 });
  const t = lege(state, ctx, s2, { length: 11, beam: 3.6 });
  t.trip = { out: 1e9, back: 1e9, away: false };
  fuelle(state, ctx);
  const gast = boot(state);
  assert.equal(sim.raftWhyNot(state, ctx, gast, s1 + '+'), 'innerBusy');
  assert.equal(sim.raftWhyNot(state, ctx, gast, s2 + '+'), 'innerBusy');
  const z = sim.raftTargets(state, ctx, gast.id);
  assert.ok(!z.includes(s1 + '+') && !z.includes(s2 + '+'));
  const eins = neu({ stufe: 1 });
  assert.ok(!Object.keys(eins.ctx.berthById).some((id) => id.endsWith('+') && sim.berthAvailable(eins.state, eins.ctx.berthById[id])), 'Stufe 1 hat keine Stirnplätze');
});

test('Ansicht kann einen Päckchenplatz sperren (Fahrwasser)', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  lege(state, ctx, s1, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const gast = boot(state);
  ctx.raftFits = (inner) => inner !== s1;
  assert.equal(sim.raftWhyNot(state, ctx, gast, s1 + '+'), 'fairway');
  assert.ok(!sim.raftTargets(state, ctx, gast.id).includes(s1 + '+'));
});

test('Stufenausbau: außen verholt zuerst oder reist ab, dann wird innen umgelegt', () => {
  const { ctx, state } = neu({ stufe: 4 });
  const p = stirn(state, ctx).find((id) => ctx.berthById[id].stages.includes(4) && !ctx.berthById[id].stages.includes(5));
  assert.ok(p, 'ein Stirnplatz, der in Stufe 5 wegfällt');
  const innen = lege(state, ctx, p, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const gast = lege(state, ctx, p + '+');
  state.money = 1e9;
  const r = sim.advanceStage(state, ctx, { prepaid: true });
  assert.ok(r.ok !== false, JSON.stringify(r.reason));
  assert.equal(state.berths[p + '+'], undefined);
  for (const b of [innen, gast]) {
    const jetzt = state.boats[b.id];
    if (jetzt) assert.ok(!sim.isRaftBerth(jetzt.berthId) && state.berths[jetzt.berthId] === b.id, 'liegt in einer echten Box');
  }
});

test('Laden: Päckchen ohne inneres Boot wird repariert, Päckchen mit innerem bleibt', () => {
  const { ctx, state } = neu();
  const [s1, s2] = stirn(state, ctx);
  lege(state, ctx, s1, { length: 11, beam: 3.6 });
  const b2 = lege(state, ctx, s2, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const g1 = lege(state, ctx, s1 + '+');
  const g2 = lege(state, ctx, s2 + '+');
  const st = deserialize(serialize(state));
  assert.equal(st.berths[s1 + '+'], g1.id);
  delete st.boats[b2.id];
  delete st.berths[s2];
  const ch = sim.repairBerths(st, ctx);
  assert.equal(st.berths[s1 + '+'], g1.id, 'mit innerem Boot bleibt es');
  assert.ok(ch.some((c) => c.boatId === g2.id), 'ohne inneres Boot umgelegt oder abgereist');
  assert.equal(st.berths[s2 + '+'], undefined);
});

test('Sturm: äußeres Boot verholt zuerst, das innere bleibt sonst liegen', () => {
  const { ctx, state } = neu();
  const [s1] = stirn(state, ctx);
  const innen = lege(state, ctx, s1, { length: 11, beam: 3.6 });
  fuelle(state, ctx);
  const gast = lege(state, ctx, s1 + '+');
  // eine geschützte Box frei: nur einer kann hinein
  const frei = sim.availableBerths(state, ctx).find((b) => b.kind === 'box' && !b.exposed && sim.fits(innen, b, ctx.rules, state.stage));
  delete state.boats[state.berths[frei.id]];
  delete state.berths[frei.id];
  sturmklar(state, ctx, { id: 'sturm', startDay: state.day, endDay: state.day + 1 });
  assert.equal(state.berths[s1 + '+'], undefined, 'außen ist verholt');
  assert.equal(gast.berthId, frei.id);
  assert.equal(innen.berthId, s1, 'innen bleibt (keine zweite Box frei)');
});
