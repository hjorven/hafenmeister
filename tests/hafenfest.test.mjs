// Eigenes Hafenfest (P38, F12): ansetzen, Abstand zu anderen Ereignissen, Kosten, Wirkung, Bilanz.
// Logik ohne Browser, mit den echten Zahlen aus economy.js. Aufruf: node --test tests/hafenfest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { createScheduler, seasonOf } from '../web/js/events/scheduler.js';
import * as F from '../web/js/features/hafenfest-regeln.js';

const S = ECONOMY.zeit.saisonTage, W = ECONOMY.zeit.winterTage, Y = S + W;
const HF = ECONOMY.ereignisse.hafenfest;

/** Planer bis zum Tag vorrechnen */
function planer({ seed = 3, bis = 1, stage = 3, buildings = {} } = {}) {
  const s = createScheduler({ seed });
  for (let d = 1; d <= bis; d++) s.advanceTo(d, { stage, buildings });
  return s;
}
/** Spielstand nur mit Tag, Stufe und Geld (für die reinen Regeln) */
const zustand = (day, stage = 3, money = 99999) => ({ day, stage, money, modules: {}, stats: { dayIncome: 0, totalIncome: 0 }, berths: {}, boats: {} });

test('Hafenfest kommt nicht von selbst, die anderen Ereignisse schon', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = createScheduler({ seed });
    let andere = 0;
    for (let d = 1; d <= Y * 5; d++) {
      for (const c of s.advanceTo(d, { stage: 6, buildings: { segelclub: 1, raeucherei: 1 } })) {
        assert.notEqual(c.event.id, 'hafenfest', `Seed ${seed}, Tag ${d}: ${c.type}`);
        if (c.type === 'start') andere++;
      }
    }
    assert.ok(andere > 15);
  }
});

test('Tage wählen: Vorlauf, Saisonfenster, feste Feste und Hanse-Woche bleiben frei', () => {
  const s = planer({ bis: 1, stage: 5 });
  const st = zustand(1, 5);
  const tage = F.festTage(st, s);
  assert.deepEqual(tage.map((t) => t.saisonTag), Array.from({ length: HF.saison[1] - HF.saison[0] + 1 }, (_, i) => HF.saison[0] + i));
  const grund = (sd) => tage.find((t) => t.saisonTag === sd).grund;
  // Mittsommer (Saisontag 7) mit einem ruhigen Tag davor und danach
  for (const sd of [6, 7, 8]) assert.equal(grund(sd), 'fest', `Tag ${sd}`);
  // Hanse-Woche kann ab Stufe 5 in ihrem Fenster noch kommen
  const [hv, hb] = ECONOMY.ereignisse.hansewoche.saison;
  for (let sd = hv; sd <= Math.min(HF.saison[1], hb); sd++) assert.equal(grund(sd), 'gross', `Tag ${sd}`);
  assert.ok(tage.some((t) => t.frei), 'es bleiben freie Tage');
  // Vorlauf: frühestens übermorgen
  const s2 = planer({ bis: 4, stage: 3 });
  const t2 = F.festTage(zustand(4, 3), s2);
  assert.equal(t2.find((t) => t.tag === 3)?.grund, 'vorbei');
  assert.equal(t2.find((t) => t.tag === 4)?.grund, 'vorlauf');
  assert.equal(t2.find((t) => t.tag === 5)?.grund, 'vorlauf');
});

test('Ansetzen bucht die Vorbereitung, das Fest beginnt am gewählten Tag mit seiner Wirkung', () => {
  const s = planer({ bis: 2, stage: 4 });
  const st = zustand(2, 4, 5000);
  const tag = F.festTage(st, s).find((t) => t.frei).tag;
  const teile = ['schmuck', 'musik', 'markt', 'feuerwerk'];
  const k = F.kosten(4, teile);
  assert.ok(k.summe > 0 && k.summe < 5000);
  const r = F.ansetzen(st, s, tag, teile);
  assert.ok(r.ok, r.grund);
  assert.equal(st.money, 5000 - k.summe);
  assert.equal(s.eigen.startDay, tag);
  assert.equal(F.stand(st, s).grund, 'angesetzt');
  assert.equal(F.ansetzen(st, s, tag + 1, []).ok, false, 'nur ein Fest');
  // Wetterbericht kennt das Fest, sobald es nah ist
  for (let d = 3; d < tag; d++) s.advanceTo(d, { stage: 4 });
  assert.equal(s.forecast(3).find((e) => e.day === tag)?.event?.id, 'hafenfest');
  const ch = s.advanceTo(tag, { stage: 4 });
  assert.ok(ch.some((c) => c.type === 'start' && c.event.id === 'hafenfest'));
  assert.equal(s.current.eigen, true);
  assert.equal(s.current.evening, 'feuerwerk');
  const m = s.modifiers();
  assert.equal(m.arrivalFactor, HF.wirkung.arrivalFactor);
  assert.ok(Math.abs(m.visitorFactor - HF.wirkung.visitorFactor * HF.eigen.teile.musik.wirkung.visitorFactor) < 1e-9);
  assert.ok(Math.abs(m.ratingBonus - (HF.wirkung.ratingBonus + HF.eigen.teile.schmuck.wirkung.ratingBonus)) < 1e-9);
  assert.equal(m.extraNights, 1);
  assert.equal(s.weather(tag).event, 'hafenfest');
  // Danach: Nachspiel, und in dieser Saison kein zweites Fest
  s.advanceTo(tag + 1, { stage: 4 });
  assert.equal(s.current, null);
  st.day = tag + 1;
  assert.equal(F.stand(st, s).grund, 'gefeiert');
  // Nächste Saison wieder frei
  st.day = Y + 2;
  s.advanceTo(Y + 2, { stage: 4 });
  assert.equal(F.stand(st, s).frei, true);
});

test('Ohne Teile: Grundfest ohne Feuerwerk, Musik oder Schmuck', () => {
  const s = planer({ bis: 2, stage: 3 });
  const st = zustand(2, 3);
  const tag = F.festTage(st, s).find((t) => t.frei).tag;
  assert.ok(F.ansetzen(st, s, tag, []).ok);
  s.advanceTo(tag, { stage: 3 });
  assert.equal(s.current.evening, null);
  const m = s.modifiers();
  assert.equal(m.visitorFactor, HF.wirkung.visitorFactor);
  assert.equal(m.ratingBonus, HF.wirkung.ratingBonus);
  assert.equal(m.extraNights, 0);
});

test('Zu wenig Geld, zu früh in der Stufe, im Winter: kein Fest', () => {
  const s = planer({ bis: 2, stage: 3 });
  const tag = F.festTage(zustand(2, 3), s).find((t) => t.frei).tag;
  assert.equal(F.ansetzen(zustand(2, 3, 10), s, tag, ['musik']).grund, 'geld');
  assert.equal(F.ansetzen(zustand(2, 2), s, tag, []).grund, 'stufe');
  assert.equal(F.stand(zustand(S + 1, 3), planer({ bis: S + 1 })).grund, 'winter');
  assert.equal(s.eigen, null);
});

test('Absagen bis zum Vorabend: halbe Kosten zurück, danach neu ansetzen', () => {
  const s = planer({ bis: 2, stage: 4 });
  const st = zustand(2, 4, 3000);
  const frei = F.festTage(st, s).filter((t) => t.frei);
  const r = F.ansetzen(st, s, frei[0].tag, ['schmuck', 'markt']);
  assert.ok(r.ok);
  const nach = st.money;
  const a = F.absagen(st, s);
  assert.ok(a.ok);
  assert.equal(a.zurueck, Math.round(r.kosten.summe * HF.eigen.erstattung));
  assert.equal(st.money, nach + a.zurueck);
  assert.equal(s.eigen, null);
  assert.equal(F.stand(st, s).frei, true);
  assert.ok(F.ansetzen(st, s, frei[frei.length - 1].tag, []).ok, 'neu ansetzen');
  // Am Festtag selbst geht das Absagen nicht mehr
  st.day = frei[frei.length - 1].tag;
  assert.equal(F.absagen(st, s).ok, false);
});

test('Die anderen Ereignisse halten Abstand zum eigenen Fest (viele Samen, alle Stufen)', () => {
  for (const stage of [3, 4, 5, 6]) {
    for (let seed = 1; seed <= 25; seed++) {
      const s = createScheduler({ seed });
      const ctx = { stage, buildings: { segelclub: 1, raeucherei: 1 } };
      const st = zustand(1, stage);
      let fest = null;
      const belegt = [];
      for (let d = 1; d <= Y * 3; d++) {
        for (const c of s.advanceTo(d, ctx)) if (c.type === 'start') belegt.push([c.event.id, c.day, c.endDay]);
        st.day = d;
        // jede Saison am ersten möglichen Tag ab Saisontag 2 ein Fest ansetzen (wie ein eifriger Spieler)
        const sz = seasonOf(d);
        if (!sz.winter && sz.seasonDay >= 2 && F.stand(st, s).frei) {
          const frei = F.festTage(st, s).filter((t) => t.frei);
          const t = frei[(seed + d) % frei.length];
          const r = F.ansetzen(st, s, t.tag, F.TEILE.slice(0, seed % 5));
          assert.ok(r.ok, `Seed ${seed} Tag ${d}: ${r.grund}`);
          fest = t.tag;
        }
      }
      assert.ok(fest, 'mindestens ein Fest');
      const feste = belegt.filter((b) => b[0] === 'hafenfest');
      assert.ok(feste.length >= 2, `Seed ${seed} Stufe ${stage}: ${feste.length} Feste`);
      for (const [id, a, e] of belegt) {
        if (id === 'hafenfest') continue;
        for (const [, fa, fe] of feste) assert.ok(e + 1 < fa || a > fe + 1, `${id} ${a}-${e} neben Fest ${fa} (Seed ${seed}, Stufe ${stage})`);
      }
      // Die Hanse-Woche fällt nicht aus: ab Stufe 5 jedes Jahr
      if (stage >= 5) assert.equal(belegt.filter((b) => b[0] === 'hansewoche').length, 3, `Hanse-Woche Seed ${seed}`);
      // Mittsommer jedes Jahr
      assert.equal(belegt.filter((b) => b[0] === 'mittsommer').length, 3, `Mittsommer Seed ${seed} Stufe ${stage}`);
    }
  }
});

test('Speichern und Laden behält das angesetzte Fest', () => {
  const a = planer({ seed: 9, bis: 2, stage: 4 });
  const st = zustand(2, 4);
  const tag = F.festTage(st, a).find((t) => t.frei).tag;
  assert.ok(F.ansetzen(st, a, tag, ['feuerwerk', 'musik']).ok);
  const b = createScheduler({ seed: 1 });
  b.load(JSON.parse(JSON.stringify(a.save())));
  assert.deepEqual(b.eigen.teile, ['musik', 'feuerwerk']);
  for (let d = 3; d <= tag + 3; d++) {
    const ca = a.advanceTo(d, { stage: 4 }).map((c) => `${c.type}:${c.event.id}`);
    const cb = b.advanceTo(d, { stage: 4 }).map((c) => `${c.type}:${c.event.id}`);
    assert.deepEqual(cb, ca, `Tag ${d}`);
  }
  // Alter Spielstand ohne eigen
  const c = createScheduler({ seed: 1 });
  const alt = a.save();
  delete alt.eigen;
  c.load(alt);
  assert.equal(c.eigen, null);
});

test('Kosten und Wirkung je Stufe ohne Lücken, Texte für alle Teile', () => {
  assert.deepEqual(F.TEILE, ['schmuck', 'musik', 'markt', 'feuerwerk']);
  for (const t of F.TEILE) assert.ok(F.TEIL_TEXTE[t]?.name && F.TEIL_TEXTE[t]?.text);
  for (let stufe = F.AB_STUFE; stufe <= 6; stufe++) {
    const k = F.kosten(stufe, F.TEILE);
    assert.ok(k.grund > 0 && Object.values(k.teile).every((x) => x > 0), `Stufe ${stufe}`);
    if (stufe > F.AB_STUFE) assert.ok(k.summe > F.kosten(stufe - 1, F.TEILE).summe, 'teurer mit der Stufe');
    assert.ok(F.standgeld(stufe) > F.teilKosten(stufe, 'markt'), 'Markt trägt sich selbst');
  }
  const w = F.wirkung(F.TEILE);
  for (const v of Object.values(w)) assert.ok(Number.isFinite(v));
  assert.equal(F.wirkung([]), null);
  assert.ok(F.menschen(['musik']).ort > F.menschen([]).ort);
});

// ------------------------------------------------------------------ mit den Spielregeln
function spiel({ stufe = 4, seed = 5 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const plan = createScheduler({ seed });
  F.haengeEin((name, fn) => sim.addHook(ctx, name, fn), { plan: () => plan });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  return { ctx, state, plan };
}

test('Abend vor dem Fest: Vorabend-Ereignis; Festabend: Standgeld und Bilanz', () => {
  const { ctx, state, plan } = spiel();
  plan.advanceTo(state.day, { stage: state.stage });
  state.money = 50000;
  const tag = F.festTage(state, plan).find((t) => t.frei && t.tag > state.day + 2)?.tag;
  assert.ok(tag, 'freier Tag');
  assert.ok(F.ansetzen(state, plan, tag, ['markt', 'schmuck']).ok);
  // Vorabend
  state.day = tag - 1;
  plan.advanceTo(state.day, { stage: state.stage });
  const ev1 = [];
  for (const fn of ctx.hooks.evening) fn({ state, ctx, boats: sim.mooredBoats(state), events: ev1, addIncome: (a, q, d) => sim.addIncome(state, a, q, d) });
  assert.ok(ev1.some((e) => e.type === 'hafenfestVorabend' && e.tag === tag));
  // Festabend
  state.day = tag;
  plan.advanceTo(state.day, { stage: state.stage });
  const vorher = state.money;
  const ev2 = [];
  for (const fn of ctx.hooks.evening) fn({ state, ctx, boats: sim.mooredBoats(state), events: ev2, addIncome: (a, q, d) => sim.addIncome(state, a, q, d) });
  const e = ev2.find((x) => x.type === 'hafenfestErgebnis');
  assert.ok(e, 'Bilanz');
  assert.equal(e.standgeld, F.standgeld(state.stage));
  assert.equal(state.money, vorher + e.standgeld);
  assert.ok(e.kosten > 0);
  assert.ok(e.voll >= 0 && e.voll <= 1);
  assert.equal(F.fState(state).gefeiert, 1);
  assert.equal(sim.heute(state).details.sonstiges.hafenfest, e.standgeld);
});

test('Päckchen am Festabend: der Abzug entfällt', () => {
  const { ctx } = spiel();
  const boot = { paeckchen: 'B01', festPaeckchen: true };
  const abzug = sim.raftPenalty(ctx, boot);
  assert.ok(abzug > 0);
  const extra = ctx.hooks.rating.reduce((a, fn) => a + (Number(fn({ ctx, boat: boot })) || 0), 0);
  assert.equal(extra, abzug);
  const ohne = ctx.hooks.rating.reduce((a, fn) => a + (Number(fn({ ctx, boat: { paeckchen: 'B01' } })) || 0), 0);
  assert.equal(ohne, 0);
});
