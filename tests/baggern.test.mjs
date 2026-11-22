// Baggern und Niedrigwasser (features/baggern.js, sim.js syncDredge, docs/baggern.md, Roadmap P29).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { waehleSchritt, leer } from '../web/js/ui/bauen-rat.js';
import * as B from '../web/js/features/baggern.js';
import { gruendeAusAbreise } from '../web/js/ui/gaestebuch-daten.js';

const E = ECONOMY.baggern;

function neu({ stage = 3, money = 100000, harbor = HAFEN, seed = 5 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stage);
  state.money = money;
  state.queue = []; state.upcoming = []; state.scheduledDay = state.day;
  return { ctx, state };
}
const boot = (state, props) => {
  const b = { id: state.nextId++, typeId: 'M2', modelId: null, name: 'Tief', size: 'M', length: 8, beam: 2.6, draft: 1.5, motor: false,
    special: false, dayVisitors: 0, stationed: false, wishes: [], nights: 2, status: 'waiting', arriveAt: 0, waitingSince: 0, berthId: null,
    wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props };
  state.boats[b.id] = b;
  state.queue.push(b.id);
  return b;
};
const legeAn = (state, b, id) => { state.queue = state.queue.filter((x) => x !== b.id); b.status = 'moored'; b.berthId = id; state.berths[id] = b.id; };
// flachste freie M-Box an Steg B
const flachsteB = (state, ctx) => sim.availableBerths(state, ctx).filter((b) => b.jetty === 'B' && b.kind === 'box' && sim.isFree(state, b.id))
  .sort((a, b) => sim.naturalDepth(a, state.stage) - sim.naturalDepth(b, state.stage))[0];

test('Zahlen: Zieltiefe je Klasse, Preise, Niedrigwasser in sinnvollen Grenzen', () => {
  assert.ok(E && E.abStufe >= 2);
  for (const k of ['S', 'M', 'L']) assert.ok(E.ziel[k] > 0 && E.jeMeter[k] > 0, k);
  assert.ok(E.ziel.S < E.ziel.M && E.ziel.M < E.ziel.L);
  const nw = E.niedrigwasser;
  assert.ok(nw.tiefe[0] > 0 && nw.tiefe[1] >= nw.tiefe[0] && nw.tiefe[1] <= 1);
  // Erst ab mehr als 0,3 m (Wasser unter dem Kiel) berührt ein passend liegendes Boot den Grund
  assert.ok(nw.tiefe[1] > ECONOMY.passregel.wasserUnterKiel);
});

test('Stufe 1: nichts zu baggern', () => {
  const { ctx, state } = neu({ stage: 1 });
  assert.deepEqual(B.angebote(state, ctx), []);
});

test('Stufe 3: Steg B lässt sich ausbaggern, danach passt ein tiefes Boot in die flache Box', () => {
  const { ctx, state } = neu();
  const a = B.angebote(state, ctx).find((x) => x.steg === 'B');
  assert.ok(a, 'Angebot für Steg B');
  assert.ok(a.neu.length > 0 && a.kosten > 0);
  assert.equal(a.kosten, B.preis(B.betroffen(state, ctx, 'B')));
  assert.equal(a.spaeter, 4, 'mit Stufe 4 wird Steg B ohnehin tief');
  const box = flachsteB(state, ctx);
  const b = boot(state, { draft: 1.5 });
  assert.equal(sim.whyNotFit(b, box, ctx.rules, state.stage), 'draft');
  const geld = state.money;
  const r = B.kaufen(state, ctx, 'B');
  assert.ok(r.ok);
  assert.equal(state.money, geld - a.kosten);
  assert.equal(state.buildings['bagger:B'], 1);
  assert.equal(sim.whyNotFit(b, box, ctx.rules, state.stage), null);
  assert.ok(sim.berthDepth(box, state.stage) >= E.ziel.M);
  // Nicht noch einmal im Angebot, zweiter Kauf scheitert
  assert.ok(!B.angebote(state, ctx).some((x) => x.steg === 'B'));
  assert.equal(B.kaufen(state, ctx, 'B').grund, 'schon');
  // Andere Stege bleiben, wie sie sind
  const a2 = ctx.berths.find((x) => x.jetty === 'A' && sim.berthAvailable(state, x));
  assert.equal(sim.berthDepth(a2, state.stage), sim.naturalDepth(a2, state.stage));
});

test('Zu wenig Geld: kein Kauf, nichts verändert', () => {
  const { ctx, state } = neu({ money: 10 });
  const r = B.kaufen(state, ctx, 'B');
  assert.equal(r.grund, 'geld');
  assert.equal(state.money, 10);
  assert.equal(state.buildings['bagger:B'], undefined);
});

test('Rückgängig (Bau weg) und neuer Spielstand im selben Kontext: Tiefe folgt dem Spielstand', () => {
  const { ctx, state } = neu();
  B.kaufen(state, ctx, 'B');
  const box = flachsteB(state, ctx);
  assert.ok(box.gebaggert > 0);
  delete state.buildings['bagger:B'];
  sim.syncDredge(state, ctx);
  assert.equal(box.gebaggert, undefined);
  // Ein anderer Spielstand mit gleichem Bauzustand, aber ohne Baggern
  state.buildings['bagger:B'] = 1;
  sim.syncDredge(state, ctx);
  const anderer = sim.applyTestStage(createState({ seed: 9, rules: ctx.rules }), ctx, 3);
  sim.tick(anderer, ctx, 0);
  assert.equal(box.gebaggert, undefined, 'tick trägt den neuen Spielstand ein');
});

test('Laden: Gast in ausgebaggerter Box bleibt liegen, auch wenn der Kontext frisch ist', () => {
  const { ctx, state } = neu();
  B.kaufen(state, ctx, 'B');
  const box = flachsteB(state, ctx);
  const b = boot(state, { draft: 1.5 });
  legeAn(state, b, box.id);
  const geladen = deserialize(serialize(state));
  const ctx2 = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  assert.deepEqual(sim.repairBerths(geladen, ctx2), []);
  assert.equal(geladen.boats[b.id].berthId, box.id);
});

test('Ausbau der Stufe: ausgebaggerte Plätze bleiben mindestens so tief', () => {
  const { ctx, state } = neu();
  B.kaufen(state, ctx, 'B');
  for (const b of ctx.berths.filter((x) => x.jetty === 'B' && sim.dredgeTarget(ctx.rules, x) > 0)) {
    for (const s of [3, 4, 5, 6]) assert.ok(sim.berthDepth(b, s) >= sim.dredgeTarget(ctx.rules, b) - 1e-9, `${b.id} Stufe ${s}`);
  }
});

test('Fest vergebene Plätze und Päckchen werden nicht ausgebaggert', () => {
  const { ctx } = neu();
  for (const b of Object.values(ctx.berthById)) {
    if (b.reserved || b.raft) assert.equal(sim.dredgeTarget(ctx.rules, b), 0, b.id);
  }
});

test('Jedes Stegbild, Stufe 2 bis 6: jedes Angebot bringt einer Bootsart der Stufe tieferes Wasser', () => {
  const grund = structuredClone(HAFEN);
  let n = 0;
  for (let nr = 0; nr <= STEGBILDER.varianten.length; nr++) {
    const h = nr ? stegbildSetzen(structuredClone(grund), nr) : grund;
    for (let stufe = 2; stufe <= 6; stufe++) {
      const { ctx, state } = neu({ stage: stufe, harbor: h });
      for (const a of B.angebote(state, ctx)) {
        n++;
        assert.ok(a.neu.length > 0, `Stegbild ${nr} Stufe ${stufe} ${a.steg}`);
        assert.ok(a.kosten >= E.grund && a.kosten < 5000, `Preis ${a.kosten}`);
        assert.ok(a.zuFlach > 0 && a.zuFlach <= a.alle);
        // Was der Text verspricht, stimmt: nach dem Baggern passt die Art an ihre Plätze
        B.kaufen(state, ctx, a.steg);
        for (const t of a.neu) {
          const typ = ctx.typeById[t.typeId];
          const probe = { size: typ.size, length: typ.length[0], beam: typ.beam[0], draft: t.draft, stationed: false };
          assert.ok(t.plaetze.some((id) => sim.fits({ ...probe, length: Math.min(probe.length, ctx.berthById[id].maxLength) }, ctx.berthById[id], ctx.rules, stufe)),
            `Stegbild ${nr} Stufe ${stufe} ${a.steg} ${t.typeId}`);
        }
      }
    }
  }
  assert.ok(n > 10, `nur ${n} Angebote`);
});

test('Wasserstand: nur starker Wind aus West bis Nordwest, Sturm am tiefsten, nie im Winter', () => {
  const nw = E.niedrigwasser;
  assert.equal(B.wasserstand({ wind: 0.9, richtung: 0 }), 0, 'Ost');
  assert.equal(B.wasserstand({ wind: 0.3, richtung: 180 }), 0, 'schwach');
  assert.equal(B.wasserstand({ wind: nw.ab, richtung: 180 }), -nw.tiefe[0]);
  assert.equal(B.wasserstand({ wind: 0.2, richtung: 135, event: 'sturm' }), -nw.tiefe[1]);
  assert.equal(B.wasserstand({ wind: 1, richtung: 225, part: 'winter' }), 0);
  assert.equal(B.wasserstand({ wind: 1, richtung: 270 }), 0, 'Süd');
  assert.equal(B.wasserstand('sturm'), 0, 'Klangereignis mit Text statt Wetter');
  const m = B.wasserstand({ wind: 0.8, richtung: 200 });
  assert.ok(m < -nw.tiefe[0] && m > -nw.tiefe[1]);
});

test('Niedrigwasser: tiefes Boot findet heute keine knappe Box, ausgebaggerte Box schon; Dauerlieger zählen nicht', () => {
  const { ctx, state } = neu();
  const remove = B.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const box = flachsteB(state, ctx);
  // Ein Boot, das an Normaltagen gerade so passt
  const tg = sim.naturalDepth(box, state.stage) - ctx.rules.underKeelClearance;
  const b = boot(state, { draft: tg });
  assert.equal(sim.whyNotFit(b, box, ctx.rules, state.stage), null);
  assert.equal(sim.hookWhyNotFit(state, ctx, b, box), null);
  B.setzePegel(state, ctx, { wind: 1, richtung: 180 });
  assert.ok(B.pegelHeute(state) < 0);
  assert.equal(sim.hookWhyNotFit(state, ctx, b, box), 'niedrigwasser');
  assert.equal(sim.hookWhyNotFit(state, ctx, { ...b, stationed: true }, box), null);
  // Dauerhaft passt das Boot weiter (Laden räumt niemanden um)
  assert.equal(sim.whyNotFit(b, box, ctx.rules, state.stage), null);
  // Baggern hilft auch heute
  assert.deepEqual(sim.dredgeWouldHelp(state, ctx, b), ['B']);
  B.kaufen(state, ctx, 'B');
  assert.equal(sim.hookWhyNotFit(state, ctx, b, box), null);
  // Nächster Tag ohne neues Wetter: Pegel gilt nicht mehr
  state.day++;
  assert.equal(B.pegelHeute(state), 0);
  remove();
});

test('Niedrigwasser: knapp liegender Gast sitzt im Schlick, einmal am Tag, schlechtere Bewertung, zählt fürs Baggern', () => {
  const { ctx, state } = neu();
  const remove = B.haengeEin((n, f) => sim.addHook(ctx, n, f));
  const box = flachsteB(state, ctx);
  const b = boot(state, { draft: sim.naturalDepth(box, state.stage) - ctx.rules.underKeelClearance });
  legeAn(state, b, box.id);
  const weit = boot(state, { draft: 0.2, size: 'S', length: 4, beam: 1.4, typeId: 'S1' });
  const andere = sim.availableBerths(state, ctx).find((x) => x.jetty === 'B' && x.id !== box.id && sim.isFree(state, x.id));
  legeAn(state, weit, andere.id);
  const ohne = sim.ratingParts(ctx, b);
  B.setzePegel(state, ctx, { wind: 1, richtung: 180 });
  const ev = [];
  B.grundTick({ state, ctx, events: ev });
  B.grundTick({ state, ctx, events: ev });
  assert.equal(ev.length, 1, 'nur das knappe Boot, nur einmal');
  assert.equal(ev[0].boatId, b.id);
  assert.equal(ev[0].baggernHilft, true);
  assert.equal(b.aufGrund, state.day);
  assert.equal(B.flachZahl(state, 'B'), 1);
  assert.ok(B.kartenSatz(state, b).includes('Schlick'));
  assert.equal(B.kartenSatz(state, weit), null);
  const mit = sim.ratingParts(ctx, b);
  assert.ok(JSON.stringify(mit) !== JSON.stringify(ohne), 'Bewertung ändert sich');
  assert.ok(Math.abs(mit.value - ohne.value) > 0.05 || ohne.value === ctx.rules.rating.min, 'Note sinkt');
  assert.equal(mit.aufGrund, true);
  // Gästebuch nennt den Grund mit dem Abzug, Komfort bleibt wie ohne Schlick
  const gb = gruendeAusAbreise({ type: 'departed', parts: mit });
  assert.deepEqual(gb.gruende.find((g) => g.key === 'schlick'), { key: 'schlick', n: E.niedrigwasser.anker });
  assert.deepEqual(gb.plus.find((x) => x.key === 'komfort'), gruendeAusAbreise({ type: 'departed', parts: ohne }).plus.find((x) => x.key === 'komfort'));
  // Nach dem Baggern zählt nichts mehr für Steg B
  B.kaufen(state, ctx, 'B');
  assert.equal(B.flachZahl(state, 'B'), 0);
  B.merken(state, ['B']);
  assert.equal(B.flachZahl(state, 'B'), 0);
  remove();
});

test('Weggefahren, obwohl an Steg B eine Box frei gewesen wäre: Ereignis nennt den Steg', () => {
  const { ctx, state } = neu();
  // Alle tiefen Plätze, an die das Boot passt, belegen; frei bleibt nur zu Flaches
  const b = boot(state, { draft: 1.5 });
  let n = 0;
  for (const p of sim.availableBerths(state, ctx)) {
    if (sim.isFree(state, p.id) && sim.fits(b, p, ctx.rules, state.stage)) {
      const f = boot(state, { draft: 0.2 });
      legeAn(state, f, p.id); n++;
    }
  }
  assert.ok(n > 0);
  assert.ok(sim.fittingBerths(state, ctx, b.id).length === 0);
  const r = sim.dismiss(state, ctx, b.id);
  const ev = (r.events ?? []).find((e) => e.type === 'turnedAway' || e.type === 'dismissed');
  assert.ok(ev, JSON.stringify(r));
  assert.deepEqual(ev.zuFlach, ['B']);
});

test('Als Nächstes: nach drei Booten mit zu viel Tiefgang wird Baggern vorgeschlagen', () => {
  const e = { key: 'baggern:B', art: 'steg', nachruesten: 'baggern', baggern: true, name: 'Steg B ausbaggern', kosten: 480, vermisst: 3 };
  const s = waehleSchritt({ geld: 100, eintraege: [e], bedarf: leer(), stufe: null });
  assert.equal(s.ziel, 'baggern:B');
  assert.match(s.text, /Tiefgang/);
  const ruhig = waehleSchritt({ geld: 1000, eintraege: [{ ...e, vermisst: 1 }], bedarf: leer(), stufe: null });
  assert.ok(!ruhig || !/Tiefgang/.test(ruhig.text));
});
