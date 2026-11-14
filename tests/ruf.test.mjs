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

// ---------------------------------------------------------------- Teil 2: Kapazität, Wege, Auszeichnung

function liegendesBoot(ctx, state, wishes, berthPick = 0) {
  const b = sim.rollBoat(state, ctx);
  b.id = state.nextId++;
  b.wishes = wishes;
  b.status = 'waiting';
  b.waitingSince = 0;
  state.boats[b.id] = b;
  state.queue.push(b.id);
  const platz = sim.fittingBerths(state, ctx, b.id)[berthPick];
  return { b, platz };
}

test('Versorgung heute voll: die Bootskarte nennt den Wunsch (berthValue.full)', () => {
  const { ctx, state } = neu({ stufe: 3 });
  const vorher = sim.facilityLoad(state, ctx);   // Auslastung aus P55
  state.served = { wc: vorher.wc.kapazitaet };
  // Bootskarte: berthValue nennt die volle Versorgung
  const { b } = liegendesBoot(ctx, state, ['wc']);
  assert.deepEqual(sim.berthValue(state, ctx, b.id).full, ['wc']);
});

test('Weiter Weg: WC weit weg zählt für die Note halb, das Liegegeld bleibt voll', () => {
  const ergebnis = {};
  for (const meter of [40, 300]) {
    const { ctx, state } = neu({ stufe: 3 });
    sim.addHook(ctx, 'walk', ({ wish }) => (wish === 'wc' ? meter : null));
    const { b, platz } = liegendesBoot(ctx, state, ['wc']);
    const wert = sim.berthValue(state, ctx, b.id, platz);
    sim.assign(state, ctx, b.id, platz);
    const boot = state.boats[b.id];
    ergebnis[meter] = { wert, boot: { met: boot.wishesMet, far: boot.far }, parts: sim.ratingParts(ctx, boot) };
  }
  assert.equal(ergebnis[40].boot.met, 1);
  assert.equal(ergebnis[300].boot.met, 0.5);
  assert.deepEqual(ergebnis[300].boot.far, { wc: 1 });
  assert.equal(ergebnis[300].parts.far.wc, 1);
  assert.deepEqual(ergebnis[300].wert.far, ['wc']);
  assert.equal(ergebnis[300].wert.fee, ergebnis[40].wert.fee, 'Liegegeld gleich');
  assert.ok(ergebnis[300].wert.anchors < ergebnis[40].wert.anchors, 'Note niedriger');
});

test('Weiter Weg: nur für WC und Dusche, ohne Hook oder ohne Gebäude zählt alles voll', () => {
  const { ctx, state } = neu({ stufe: 3 });
  const berth = ctx.berths[0];
  assert.deepEqual(sim.walkShare(state, ctx, berth, 'wc'), { far: false, share: 1, meters: null });
  sim.addHook(ctx, 'walk', () => 999);
  assert.equal(sim.walkShare(state, ctx, berth, 'essen').share, 1);
  assert.equal(sim.walkShare(state, ctx, berth, 'dusche').share, ctx.rules.walk.share);
  const ctx2 = neu({ stufe: 3 }).ctx;
  sim.addHook(ctx2, 'walk', () => null);
  assert.equal(sim.walkShare(state, ctx2, berth, 'wc').share, 1, 'unbekannte Entfernung zählt voll');
});

test('Auszeichnung: drei Abende über der Marke, eine Stufe nach der anderen, zurück erst unter der Haltemarke', () => {
  const { ctx, state } = neu({ stufe: 4 });
  const a = ctx.rules.award;
  const abend = (ruf) => {
    state.ratings = Array(40).fill(ruf);
    state.ratingDays = Array(40).fill(state.day);
    const ev = [];
    // nur die Auswertung des Abends: über runDay wäre der Tag voll Boote
    sim.updateAward(state, ctx, ev);
    return ev;
  };
  assert.equal(sim.award(state, ctx.rules).level, 0);
  abend(4.7); abend(4.7);
  assert.equal(sim.award(state, ctx.rules).level, 0, 'nach zwei Abenden noch nicht');
  const ev = abend(4.7);
  assert.equal(ev[0]?.type, 'awardUp');
  assert.equal(ev[0].name, a.levels[0].name);
  assert.equal(ev[0].first, true);
  for (let i = 0; i < a.days * 2; i++) abend(4.7);
  assert.equal(sim.award(state, ctx.rules).level, 3);
  assert.equal(sim.award(state, ctx.rules).next, null);
  // knapp unter der Marke, aber über der Haltemarke: bleibt
  for (let i = 0; i < 5; i++) abend(a.levels[2].from - a.hold / 2);
  assert.equal(sim.award(state, ctx.rules).level, 3);
  // drei Abende darunter: eine Stufe zurück
  abend(4.0); abend(4.0);
  const runter = abend(4.0);
  assert.equal(runter[0]?.type, 'awardDown');
  assert.equal(runter[0].lost, a.levels[2].name);
  assert.equal(sim.award(state, ctx.rules).level, 2);
  assert.equal(sim.award(state, ctx.rules).best, 3);
});

test('Auszeichnung: im Winter zählt kein Abend, Spielstand mit und ohne Auszeichnung lädt', async () => {
  const { ctx, state } = neu({ stufe: 4 });
  state.day = ctx.rules.seasonDays + 2; // Winter
  state.ratings = Array(40).fill(4.9);
  state.ratingDays = Array(40).fill(state.day);
  for (let i = 0; i < 5; i++) sim.updateAward(state, ctx, []);
  assert.equal(sim.award(state, ctx.rules).level, 0);
  const { serialize, deserialize } = await import('../web/js/state.js');
  const kopie = JSON.parse(serialize(state));
  kopie.award = { level: 2, up: 1, down: 0, best: 2 };
  assert.equal(deserialize(JSON.stringify(kopie)).award.level, 2);
  delete kopie.award;
  assert.equal(deserialize(JSON.stringify(kopie)).award.level, 0, 'älterer Spielstand: ohne Auszeichnung');
  kopie.award = { level: 'drei' };
  assert.throws(() => deserialize(JSON.stringify(kopie)));
});

test('Gästebuch: weiter Weg steht als Grund da, Auszeichnung hat einen Satz', async () => {
  const D = await import('../web/js/ui/gaestebuch-daten.js');
  const { gruende, plus } = D.gruendeAusAbreise({ parts: { wishes: ['dusche'], wishesTotal: 1, wishesMet: 0.5, missed: {}, far: { dusche: 1 }, penalty: 0, bonus: 0, comfort: 0, special: 0, snug: 0, byHand: 0 } });
  assert.deepEqual(gruende, [{ key: 'weit:dusche', n: 1 }]);
  assert.ok(!plus.some((p) => p.key === 'wuensche'), 'nicht "alle Wünsche erfüllt"');
  assert.match(D.erklaerung({ gruende, plus }), /weiter Weg zur Dusche/);
  const A = await import('../web/js/features/auszeichnung.js');
  const { ctx, state } = neu({ stufe: 4 });
  const leer = sim.award(state, ctx.rules);
  assert.match(A.text(leer), /Noch keine Auszeichnung/);
  assert.match(A.text(leer), /dann heißt der Hafen „Gastlicher Hafen“/);
  assert.doesNotMatch(A.text(leer), /zum „/, 'Name steht nie im Dativ hinter "zum"');
  state.award = { level: 3, up: 0, down: 0, best: 3 };
  assert.match(A.text(sim.award(state, ctx.rules)), /Höher geht es nicht/);
  assert.match(A.karte({ type: 'awardDown', level: 2, name: 'Empfohlener Hafen', lost: 'Ausgezeichneter Hafen' }).titel, /Empfohlener Hafen/);
  assert.match(A.wimpelSvg(2), /^<svg/);
});

test('Wege im Bild: nächstes gebautes Gebäude, Sanitärgebäude zählt auch für die Dusche', async () => {
  const V = await import('../web/js/features/versorgung.js');
  assert.deepEqual(V.gebauteFuer('dusche', { wc: 1, dusche: 1 }), ['dusche']);
  assert.deepEqual(V.gebauteFuer('dusche', { wc: 3, dusche: 1 }), ['dusche', 'sanitaer']);
  assert.deepEqual(V.gebauteFuer('wc', { wc: 0 }), []);
  assert.equal(V.kuerzesterWeg({ x: 0, z: 0 }, [{ x: 3, z: 4 }, null, { x: 30, z: 0 }]), 5);
  assert.equal(V.kuerzesterWeg({ x: 0, z: 0 }, []), null);
});
