// Nordsee mit Ebbe und Flut (features/gezeiten-regeln.js, docs/nordsee.md, Roadmap P57).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as G from '../web/js/features/gezeiten-regeln.js';

const N = ECONOMY.nordsee;

function neu({ stage = 2, region = 'nordsee', seed = 5, hooks = true } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stage);
  state.region = region;
  state.money = 100000;
  state.queue = []; state.upcoming = []; state.scheduledDay = state.day;
  if (hooks) G.haengeEin((n, f) => sim.addHook(ctx, n, f));
  return { ctx, state };
}
const boot = (state, props) => {
  const b = { id: state.nextId++, typeId: 'M2', modelId: null, name: 'Tief', size: 'M', kind: 'segelyacht', length: 8, beam: 2.6, draft: 1.5, motor: false,
    special: false, dayVisitors: 0, stationed: false, wishes: [], nights: 2, status: 'waiting', arriveAt: 0, waitingSince: 0, berthId: null,
    atBuoy: true, atBuoySince: 0, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0, ...props };
  state.boats[b.id] = b;
  state.queue.push(b.id);
  return b;
};
// Spieluhr des Tages mit dem niedrigsten und dem höchsten Wasser
function extrem(state, ctx) {
  let lo = 0, hi = 0;
  for (let t = 0; t <= ctx.rules.dayLength; t++) {
    if (G.wasserstand(state, ctx, t) < G.wasserstand(state, ctx, lo)) lo = t;
    if (G.wasserstand(state, ctx, t) > G.wasserstand(state, ctx, hi)) hi = t;
  }
  return { lo, hi };
}

test('Zahlen: Tide, Zufahrt je Stufe wird tiefer, Revierfaktoren', () => {
  assert.ok(N && N.gezeiten.hub > 2 && N.gezeiten.hub < 4);
  for (let s = 2; s <= 6; s++) assert.ok(N.zufahrt[s] >= N.zufahrt[s - 1], `Stufe ${s}`);
  assert.ok(N.planen > 0 && N.planen < 1);
  assert.ok(N.hafengeld > 0 && N.ankuenfte > 0);
});

test('Wasserstand: zwischen Spring-Niedrigwasser und Spring-Hochwasser, Hochwasser rund 50 Minuten später je Tag', () => {
  const g = N.gezeiten;
  let min = Infinity, max = -Infinity;
  for (let h = 0; h < 24 * 30; h += 0.1) {
    const w = G.wasserstandBei(h);
    min = Math.min(min, w); max = Math.max(max, w);
  }
  assert.ok(min < 0 && min > -g.hub * g.springFaktor, `min ${min}`);
  assert.ok(max > g.hub && max < g.hub * (1 + g.springFaktor) + 1e-9, `max ${max}`);
  // Hochwasser am ersten Tag zur eingestellten Uhrzeit
  assert.ok(G.wasserstandBei(g.hochwasserTag1) > G.wasserstandBei(g.hochwasserTag1 - 0.3));
  assert.ok(G.wasserstandBei(g.hochwasserTag1) > G.wasserstandBei(g.hochwasserTag1 + 0.3));
  const { ctx, state } = neu();
  // Hochwasser am Vormittag kommt am nächsten Tag rund 50 Minuten später (12,5 h Tag in dayLength Sekunden)
  const erstesHw = (tag) => G.scheitel(state, ctx, tag).find((s) => s.art === 'hw').clock;
  const minuten = (sek) => (sek / ctx.rules.dayLength) * 12.5 * 60;
  const d = minuten(erstesHw(3) - erstesHw(2));
  assert.ok(d > 40 && d < 60, `${d} Minuten`);
  state.day = 3;
  const hw = G.scheitel(state, ctx).filter((s) => s.art === 'hw');
  const nw = G.scheitel(state, ctx).filter((s) => s.art === 'nw');
  assert.ok(hw.length >= 1 && nw.length >= 1, 'jeden Tag mindestens ein Hoch- und ein Niedrigwasser');
  // Ostsee: kein Wasserstand, keine Scheitel
  state.region = 'ostsee';
  assert.equal(G.wasserstand(state, ctx), 0);
  assert.deepEqual(G.scheitel(state, ctx), []);
});

test('Zufahrt: tiefes Boot wartet bei Niedrigwasser, läuft bei Hochwasser ein; flaches Boot kommt immer', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.day = 4;
  const { lo, hi } = extrem(state, ctx);
  const tief = boot(state, { draft: 1.5 });
  const flach = boot(state, { draft: 0.2, size: 'S', length: 4, beam: 1.4, typeId: 'S1', kind: 'ruderboot' });
  const box = sim.availableBerths(state, ctx).find((b) => sim.isFree(state, b.id) && sim.fits(tief, b, ctx.rules, state.stage));
  assert.ok(box, 'eine passende Box');
  state.clock = lo;
  assert.equal(G.zufahrtOffen(state, ctx, tief), false);
  assert.equal(sim.hookWhyNotFit(state, ctx, tief, box), 'tide');
  assert.equal(sim.hookWhyNotFit(state, ctx, flach, box), null);
  assert.equal(sim.holdsForHook(state, ctx, tief), true);
  // Zuweisen von Hand scheitert mit Grund 'tide'
  const r = sim.assign(state, ctx, tief.id, box.id);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'tide');
  // Das nächste Fenster liegt später am Tag
  const ab = G.naechstesFenster(state, ctx, tief);
  assert.ok(ab > lo, 'Fenster später');
  state.clock = hi;
  assert.equal(sim.hookWhyNotFit(state, ctx, tief, box), null);
  // Liegende und feste Boote betrifft die Zufahrt nicht (Grün-Rot-Schild, Umlegen)
  assert.equal(G.fitTide({ state, ctx, boat: { ...tief, status: 'moored' } }), null);
  assert.equal(sim.berthState(state, ctx, box.id), 'frei');
  state.clock = lo;
  assert.equal(sim.berthState(state, ctx, box.id), 'frei', 'Schild bleibt grün, auch bei Niedrigwasser');
  // Anzeige "Zufahrt jetzt bis x m Tiefgang" passt zur Regel
  const moeglich = G.tiefgangMoeglich(state, ctx);
  assert.ok(moeglich < tief.draft && moeglich >= 0);
  assert.equal(G.zufahrtOffen(state, ctx, { ...tief, draft: moeglich - 0.01 }), true);
  assert.equal(G.tiefgangMoeglich({ ...state, region: 'ostsee' }, ctx), Infinity);
});

test('Warten auf Flut: keine Geduld verloren, danach fährt das Boot selbst ein', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.day = 4;
  const { lo } = extrem(state, ctx);
  state.clock = lo;
  state.phase = 'day';
  state.scheduledDay = state.day;
  const tief = boot(state, { draft: 1.5, atBuoySince: lo });
  const ab = G.naechstesFenster(state, ctx, tief);
  assert.ok(ab - lo > ctx.rules.queue.patience, 'länger zu als die Geduld');
  let eingelaufen = null;
  for (let i = 0; i < ab - lo + 20; i++) {
    const ev = sim.tick(state, ctx, 1);
    for (const e of ev) if (e.type === 'turnedAway' && e.boatId === tief.id) assert.fail('abgedreht');
    if (tief.status === 'moored') { eingelaufen = state.clock; break; }
  }
  assert.ok(eingelaufen != null, 'ist eingelaufen');
  assert.ok(eingelaufen >= ab, `nicht vor dem Fenster (${eingelaufen} >= ${ab})`);
});

test('Volle Bojen: wer auf die Flut wartet, ankert statt abzudrehen', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.day = 4;
  state.scheduledDay = state.day;
  state.clock = extrem(state, ctx).lo;
  const n = sim.waitSpotCount(state, ctx);
  for (let i = 0; i < n; i++) boot(state, { draft: 0.2, size: 'S', length: 4, beam: 1.4, typeId: 'S1', waitSpot: i });
  const tief = { ...boot(state, { draft: 1.5 }) };
  state.queue.pop(); delete state.boats[tief.id];
  tief.status = 'expected';
  tief.arriveAt = state.clock;
  state.upcoming = [tief];
  const ev = sim.tick(state, ctx, 1);
  assert.ok(!ev.some((e) => e.type === 'turnedAway' && e.boatId === tief.id), 'nicht abgedreht');
  assert.equal(state.boats[tief.id]?.status, 'waiting');
});

test('Abreise: Ablegen wird bis ins Tidenfenster verschoben, Ostsee unverändert', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.day = 4;
  const tief = { id: 99, draft: 1.5, status: 'moored', size: 'M' };
  for (let at = 0; at < ctx.rules.dayLength * 0.3; at += 7) {
    const t = sim.departTime(state, ctx, tief, at, 5);
    assert.ok(t >= at);
    assert.ok(t <= ctx.rules.dayLength * 0.95 + 1e-9);
    const ok = G.zufahrtOffen(state, ctx, tief, t, 5);
    if (!ok) {
      // kein Fenster mehr bis zum Abend: zum höchsten Wasser
      assert.equal(G.naechstesFenster(state, ctx, tief, at, ctx.rules.dayLength * 0.95, 5), null);
    }
  }
  state.region = 'ostsee';
  assert.equal(sim.departTime(state, ctx, tief, 12, 5), 12);
});

test('Planen: Ankünfte tiefer Boote liegen meist im Tidenfenster, der Tag bleibt gleich dicht', () => {
  let drin = 0, alle = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { ctx, state } = neu({ stage: 3, seed });
    state.upcoming = [];
    state.scheduledDay = -1;
    for (let d = 0; d < 6; d++) {
      state.day = 2 + d;
      state.scheduledDay = -1;
      const zeitenVorher = [];
      sim.tick(state, ctx, 0.001);
      const list = [...state.upcoming];
      zeitenVorher.push(...list.map((b) => b.arriveAt));
      for (let i = 1; i < list.length; i++) assert.ok(list[i].arriveAt >= list[i - 1].arriveAt, 'sortiert');
      for (const b of list) {
        if (b.flotte || b.spaet || !(b.draft > 0) || b.size === 'XXL') continue;
        if (G.abWasserstand(state, ctx, b) <= 0.3) continue; // fast immer offen
        alle++;
        if (G.zufahrtOffen(state, ctx, b, b.arriveAt)) drin++;
      }
      state.upcoming = [];
      state.queue = [];
    }
  }
  assert.ok(alle > 30, `genug tiefe Boote (${alle})`);
  assert.ok(drin / alle > 0.7, `im Fenster ${drin}/${alle}`);
});

test('Revierfaktoren nur an der Nordsee', () => {
  const { ctx, state } = neu();
  const m = sim.modifiers(state, ctx);
  state.region = 'ostsee';
  const o = sim.modifiers(state, ctx);
  assert.ok(Math.abs(m.priceFactor / o.priceFactor - N.hafengeld) < 1e-9);
  assert.ok(Math.abs(m.arrivalFactor / o.arrivalFactor - N.ankuenfte) < 1e-9);
  assert.equal(m.kindFactor.fischer / (o.kindFactor.fischer ?? 1), N.arten.fischer);
});

test('Ostsee: ein ganzer Spieltag mit und ohne die Gezeiten-Hooks ist gleich', () => {
  const a = neu({ stage: 3, region: 'ostsee', seed: 9 });
  const b = neu({ stage: 3, region: 'ostsee', seed: 9, hooks: false });
  for (const w of [a, b]) for (let i = 0; i < 700; i++) sim.tick(w.state, w.ctx, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(a.state)), JSON.parse(JSON.stringify(b.state)));
});
