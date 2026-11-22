// Preisstufe am Hafenbüro (P35, F6): Regeln ohne Browser, mit den echten Zahlen aus economy.js.
// Aufruf: node --test tests/preisstufe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as P from '../web/js/features/preisstufe-regeln.js';
import { gruendeAusAbreise, erklaerung, satz } from '../web/js/ui/gaestebuch-daten.js';

const PS = ECONOMY.preisstufe;
const S = ECONOMY.zeit.saisonTage, W = ECONOMY.zeit.winterTage, Y = S + W;

function neu({ seed = 3, stufe = 3, office = 1, haken = true } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  ctx.rules.queue.selfEnterAfter = null;
  ctx.rules.queue.buoyFee = 0;
  ctx.rules.trips = null;
  if (haken) P.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  state.testmodus = false;
  state.office = office;
  return { ctx, state };
}

let naechste = 9000;
function boot(state, extra = {}) {
  const id = naechste++;
  const b = { id, typeId: 'M1', modelId: null, name: 'Gast', size: 'M', length: 9, beam: 3.1, draft: 1.5, motor: false, special: false,
    dayVisitors: 0, stationed: false, wishes: [], nights: 2, status: 'waiting', waitingSince: 0, atBuoy: true, atBuoySince: 0,
    berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...extra };
  state.boats[id] = b;
  state.queue.push(id);
  return b;
}
const freieBox = (state, ctx, b) => sim.fittingBerths(state, ctx, b.id)[0]?.id ?? sim.fittingBerths(state, ctx, b.id)[0];

test('Zahlen: drei Stufen, normal ohne Wirkung, günstig billiger und gehoben teurer', () => {
  assert.deepEqual(Object.keys(PS.stufen), ['guenstig', 'normal', 'gehoben']);
  const n = PS.stufen.normal;
  assert.equal(n.liegegeld, 1); assert.equal(n.ankuenfte, 1); assert.equal(n.ruf, 0); assert.equal(n.anspruch, 0);
  assert.ok(PS.stufen.guenstig.liegegeld < 1 && PS.stufen.guenstig.ankuenfte > 1 && PS.stufen.guenstig.ruf > 0);
  assert.ok(PS.stufen.gehoben.liegegeld > 1 && PS.stufen.gehoben.ankuenfte < 1 && PS.stufen.gehoben.anspruch > 0);
  assert.equal(PS.start, 'normal');
  const { ctx } = neu();
  assert.equal(ctx.rules.priceLevels.levels.gehoben.fee, PS.stufen.gehoben.liegegeld);
});

test('Ohne Hafenbüro: keine Wahl, keine Wirkung, Boote ohne Preisstufe', () => {
  const { ctx, state } = neu({ office: 0 });
  assert.equal(P.frei(state, ctx), false);
  assert.deepEqual(P.waehle(state, ctx, 'gehoben'), { ok: false, reason: 'buero', events: [] });
  state.modules.preisstufe = { stufe: 'gehoben' };   // auch ein alter Stand wirkt nicht ohne Büro
  assert.equal(P.modifikator(state, ctx), null);
  const b = boot(state);
  P.ankunft(state, ctx, b);
  assert.equal(b.preisstufe, undefined);
});

test('Einmal je Saison, am selben Tag umentscheiden, im Winter für die kommende Saison', () => {
  const { ctx, state } = neu();
  state.day = 3;
  let r = P.waehle(state, ctx, 'gehoben');
  assert.ok(r.ok);
  assert.deepEqual(r.events[0], { type: 'preisstufe', stufe: 'gehoben', vorher: 'normal', jahr: 1, day: 3, umgestellt: r.events[0].umgestellt });
  // umentscheiden am selben Tag: erlaubt, ein Eintrag im Verlauf
  r = P.waehle(state, ctx, 'guenstig');
  assert.ok(r.ok);
  assert.equal(P.stufe(state), 'guenstig');
  assert.equal(P.pState(state).verlauf.length, 1);
  assert.equal(P.darfWaehlen(state, ctx).heuteNoch, true);
  // nächster Tag: gesperrt bis zur nächsten Saison
  state.day = 4;
  assert.deepEqual(P.waehle(state, ctx, 'normal'), { ok: false, reason: 'saison', events: [] });
  state.day = S;   // letzter Saisontag
  assert.equal(P.darfWaehlen(state, ctx).ok, false);
  // erster Wintertag: Wahl gilt für Saison 2
  state.day = S + 1;
  assert.equal(P.saisonJahr(state.day), 2);
  r = P.waehle(state, ctx, 'gehoben');
  assert.ok(r.ok);
  assert.equal(r.events[0].jahr, 2);
  // in Saison 2 dann keine weitere Wahl
  state.day = Y + 1;
  assert.equal(P.saisonJahr(state.day), 2);
  assert.equal(P.darfWaehlen(state, ctx).grund, 'saison');
  // Saison 3 im Winter davor wieder frei
  state.day = Y + S + 1;
  assert.equal(P.darfWaehlen(state, ctx).ok, true);
  assert.equal(P.pState(state).verlauf.length, 2);
  assert.deepEqual(P.waehle(state, ctx, 'teuer'), { ok: false, reason: 'unbekannt', events: [] });
});

test('Nach einem Ausbau darf in derselben Saison neu gewählt werden, einmal', () => {
  const { ctx, state } = neu({ stufe: 4 });
  state.day = 3;
  P.waehle(state, ctx, 'guenstig');
  state.day = 5;
  assert.equal(P.darfWaehlen(state, ctx).ok, false);
  state.stage = 5;
  const d = P.darfWaehlen(state, ctx);
  assert.equal(d.ok, true);
  assert.equal(d.ausbau, true);
  assert.ok(P.waehle(state, ctx, 'gehoben').ok);
  assert.equal(P.pState(state).ausbau, 5);
  state.day = 6;
  assert.equal(P.darfWaehlen(state, ctx).grund, 'saison');
  // Faustregel: in der letzten Stufe gehoben, solange der Ruf reicht
  state.stage = ctx.rules.maxStage;
  assert.ok(['gehoben', 'guenstig'].includes(P.klugeWahl(state, ctx)));
});

test('Ohne Wahl in einer Saison bleibt die alte Preisstufe', () => {
  const { ctx, state } = neu();
  state.day = 2;
  P.waehle(state, ctx, 'gehoben');
  state.day = Y * 2 + 5;    // zwei Saisons später, nie neu gewählt
  assert.equal(P.stufe(state), 'gehoben');
  assert.equal(sim.modifiers(state, ctx).priceFactor, PS.stufen.gehoben.liegegeld);
});

test('Wirkung als Modifikator: Liegegeld, Ankünfte, Klassen', () => {
  const { ctx, state } = neu();
  assert.equal(P.modifikator(state, ctx), null, 'normal: nichts');
  P.waehle(state, ctx, 'gehoben');
  const m = sim.modifiers(state, ctx);
  const g = PS.stufen.gehoben;
  // Jahreszeit kommt dazu, darum als Verhältnis zu normal
  P.pState(state).stufe = 'normal';
  const m0 = sim.modifiers(state, ctx);
  assert.equal(m.priceFactor / m0.priceFactor, g.liegegeld);
  assert.ok(Math.abs(m.arrivalFactor / m0.arrivalFactor - g.ankuenfte) < 1e-9);
  assert.ok(Math.abs((m.sizeFactor.L ?? 1) / (m0.sizeFactor.L ?? 1) - g.klassen.L) < 1e-9);
});

test('Liegegeld beim Anlegen folgt der Preisstufe, wer schon liegt, hat bezahlt', () => {
  const geld = (stufe) => {
    const { ctx, state } = neu();
    if (stufe !== 'normal') P.waehle(state, ctx, stufe);
    const b = boot(state, { nights: 2 });
    P.ankunft(state, ctx, b);
    const platz = freieBox(state, ctx, b);
    const r = sim.assign(state, ctx, b.id, platz);
    assert.ok(r.ok, r.reason);
    return r.events.find((e) => e.type === 'feeReady')?.amount;
  };
  const n = geld('normal'), g = geld('gehoben'), b = geld('guenstig');
  assert.ok(n > 0);
  // gerundet je Nacht: höchstens ein Euro je Nacht Abweichung
  assert.ok(Math.abs(g - n * PS.stufen.gehoben.liegegeld) <= 2, `gehoben ${g} statt ${n} * ${PS.stufen.gehoben.liegegeld}`);
  assert.ok(Math.abs(b - n * PS.stufen.guenstig.liegegeld) <= 2, `günstig ${b} statt ${n} * ${PS.stufen.guenstig.liegegeld}`);
});

test('Bewertung: günstig lobt und sieht nach, gehoben erwartet alles', () => {
  const { ctx } = neu();
  const r = (stufe, met, total) => sim.priceRating(ctx, { preisstufe: stufe, wishesMet: met, wishesTotal: total });
  const G = PS.stufen.gehoben, B = PS.stufen.guenstig;
  assert.equal(r(undefined, 0, 2), 0);
  assert.equal(r('normal', 0, 2), 0);
  assert.equal(r('gehoben', 2, 2), G.ruf);
  assert.equal(r('gehoben', 0, 0), G.ruf, 'ohne Wünsche nur der feste Teil');
  assert.equal(r('gehoben', 0, 2), Math.round((G.ruf - G.anspruch) * 100) / 100);
  assert.equal(r('gehoben', 1, 2), Math.round((G.ruf - G.anspruch / 2) * 100) / 100);
  assert.equal(r('guenstig', 2, 2), B.ruf);
  assert.equal(r('guenstig', 0, 2), Math.round((B.ruf - B.anspruch) * 100) / 100);
  // in ratingParts als eigener Teil
  const boat = { preisstufe: 'gehoben', wishes: ['wc', 'strom'], wishesMet: 0, wishesTotal: 2, berthId: null };
  const p = sim.ratingParts(ctx, boat);
  assert.equal(p.preis, r('gehoben', 0, 2));
  assert.equal(p.preisstufe, 'gehoben');
  const ohne = sim.ratingParts(ctx, { ...boat, preisstufe: undefined });
  assert.ok(Math.abs(ohne.value - p.value - Math.min(-p.preis, ohne.value - 1)) < 0.11);
});

test('Wechsel: wer noch kommt oder wartet, bekommt die neue Stufe; liegende Boote behalten ihre', () => {
  const { ctx, state } = neu();
  const liegt = boot(state);
  P.ankunft(state, ctx, liegt);
  sim.assign(state, ctx, liegt.id, freieBox(state, ctx, liegt));
  assert.equal(liegt.status, 'moored');
  const wartet = boot(state);
  const kommt = boot(state, { status: 'expected' });
  const dauer = boot(state, { stationed: true, status: 'expected' });
  const r = P.waehle(state, ctx, 'gehoben');
  assert.equal(liegt.preisstufe, undefined);
  assert.equal(wartet.preisstufe, 'gehoben');
  assert.equal(kommt.preisstufe, 'gehoben');
  assert.equal(dauer.preisstufe, undefined, 'Dauerlieger zahlen Pacht');
  assert.equal(r.events[0].umgestellt, 2);
  // neue Ankunft
  const neuB = boot(state);
  P.ankunft(state, ctx, neuB);
  assert.equal(neuB.preisstufe, 'gehoben');
});

test('Ankünfte: über viele Tage kommen günstig mehr und gehoben weniger Boote als normal', () => {
  const zaehle = (stufe) => {
    let n = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { ctx, state } = neu({ seed, stufe: 4 });
      if (stufe !== 'normal') P.waehle(state, ctx, stufe);
      for (let d = 0; d < 6; d++) {
        const ev = sim.tick(state, ctx, ctx.rules.dayLength + ctx.rules.eveningLength + 1);
        n += ev.filter((e) => e.type === 'arrived').length;
        for (const id of [...state.queue]) sim.dismiss?.(state, ctx, id);
      }
    }
    return n;
  };
  const n = zaehle('normal'), g = zaehle('gehoben'), b = zaehle('guenstig');
  assert.ok(b > n && n > g, `günstig ${b}, normal ${n}, gehoben ${g}`);
});

test('Spielstand: Preisstufe und Stufe am Boot bleiben erhalten', () => {
  const { ctx, state } = neu();
  P.waehle(state, ctx, 'guenstig');
  const b = boot(state);
  P.ankunft(state, ctx, b);
  const zurueck = deserialize(serialize(state));
  assert.equal(P.stufe(zurueck), 'guenstig');
  assert.equal(zurueck.modules.preisstufe.jahr, 1);
  assert.equal(zurueck.boats[b.id].preisstufe, 'guenstig');
  // alter Stand ohne Modul: normal
  const alt = deserialize(serialize(neu().state));
  assert.equal(P.stufe(alt), 'normal');
});

test('Gästebuch: zu teuer als Grund, faire Preise als Pluspunkt', () => {
  const basis = { wishes: ['wc'], wishesMet: 0, wishesTotal: 1, missed: { wc: 2 }, far: {}, penalty: 0, bonus: 0, moved: 0, comfort: 0, special: 0, snug: 0, byHand: 0, stammPlatz: 0 };
  const teuer = gruendeAusAbreise({ parts: { ...basis, preis: -1 } });
  assert.ok(teuer.gruende.some((g) => g.key === 'teuer' && g.n === 1));
  const e = { id: 1, tag: 3, note: 2.5, art: 'abreise', ...teuer, boot: {} };
  assert.match(erklaerung(e), /zu teuer für das Gebotene −1/);
  const fair = gruendeAusAbreise({ parts: { ...basis, wishes: [], wishesTotal: 0, missed: {}, preis: 0.25 } });
  assert.ok(fair.plus.some((p) => p.key === 'preis' && p.wert === 0.25));
  const e2 = { id: 2, tag: 3, note: 4.2, art: 'abreise', ...fair, boot: {} };
  assert.match(erklaerung(e2), /faire Preise \+0,25/);
  assert.ok(satz(e2).length > 5);
});

test('Wirkung in Worten nennt die Zahlen aus economy.js', () => {
  const { ctx } = neu();
  const g = P.wirkungText(ctx, 'gehoben').join(' · ');
  assert.match(g, new RegExp(`Liegegeld \\+${Math.round((PS.stufen.gehoben.liegegeld - 1) * 100)} %`));
  assert.match(P.wirkungText(ctx, 'guenstig').join(' '), /Liegegeld −/);
  assert.deepEqual(P.wirkungText(ctx, 'normal'), ['keine Zu- oder Abschläge']);
  assert.deepEqual(P.beispielPreise(ctx, 20), { guenstig: Math.round(20 * PS.stufen.guenstig.liegegeld), normal: 20, gehoben: Math.round(20 * PS.stufen.gehoben.liegegeld) });
});
