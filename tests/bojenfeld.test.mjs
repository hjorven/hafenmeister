// Bojenfeld (P36, F10): data/bojenfeld.js, features/bojenfeld.js, render/landschaft/bojenfeld-lage.js,
// Regeln in sim.js (berthKinds.boje). Beschreibung: docs/bojenfeld.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { BOJENFELD } from '../web/js/data/bojenfeld.js';
import { angebote, bauen, abschnitte, ohneLage, REGELN } from '../web/js/features/bojenfeld.js';
import { kannDauerplatz, kannBehalten } from '../web/js/features/dauerlieger.js';
import { formSetzen } from '../web/js/render/landschaft/formen.js';
import { punkt, warteplaetze } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { bojenfeldLage, hindernisse } from '../web/js/render/landschaft/bojenfeld-lage.js';

function neu({ stage = 2, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 5, rules: ctx.rules }), ctx, stage);
  state.money = money;
  return { ctx, state };
}
const boot = (o = {}) => ({ id: 'b', typeId: 'S1', size: 'S', length: 7.5, beam: 2.6, draft: 1.1, stationed: false, wishes: [], ...o });

test('Zahlen: zwei Abschnitte, Plätze BF01 bis BF12, nur S und M bis 9 m', () => {
  assert.ok(REGELN);
  assert.equal(BOJENFELD.anzahl, REGELN.abschnitte.reduce((s, a) => s + a.bojen, 0));
  assert.deepEqual(BOJENFELD.ids.slice(0, 2), ['BF01', 'BF02']);
  const bf = HAFEN.plaetze.filter((p) => p.art === 'boje');
  assert.equal(bf.length, BOJENFELD.anzahl);
  for (const p of bf) {
    assert.equal(p.maxLaenge, REGELN.maxLaenge);
    assert.equal(p.requires, BOJENFELD.projektVon[p.id]);
    assert.ok(p.stufenRegel.every((s) => s >= REGELN.abStufe));
  }
  assert.ok(REGELN.liegegeld > 0 && REGELN.liegegeld < 1);
});

test('Regeln: Boje nur nach dem Bau, nur kleine Boote, Wünsche bleiben unerfüllt, Anteil am Hafengeld', () => {
  const { ctx, state } = neu();
  const b = ctx.berthById.BF01;
  assert.equal(b.kind, 'boje');
  assert.equal(b.exposed, true);
  assert.equal(sim.berthAvailable(state, b), false, 'vor dem Bau gibt es keine Boje');
  state.buildings['bojenfeld-1'] = 1;
  assert.equal(sim.berthAvailable(state, b), true);
  assert.equal(sim.berthAvailable(state, ctx.berthById.BF07), false, 'zweiter Abschnitt fehlt noch');
  assert.ok(sim.fits(boot(), b, ctx.rules, state.stage));
  assert.ok(sim.fits(boot({ size: 'M', length: 8.9, beam: 3.2, wishes: ['strom', 'wasser'] }), b, ctx.rules, state.stage), 'Wünsche hindern nicht');
  assert.ok(!sim.fits(boot({ size: 'L', length: 8.5 }), b, ctx.rules, state.stage), 'L passt nicht');
  assert.ok(!sim.fits(boot({ size: 'M', length: 9.6 }), b, ctx.rules, state.stage), 'zu lang');
  assert.ok(!sim.fits(boot({ size: 'M', beam: 3.6 }), b, ctx.rules, state.stage), 'zu breit');
  assert.ok(!sim.fits(boot({ draft: 1.5 }), b, ctx.rules, state.stage), 'zu tief');
});

test('Liegegeld an der Boje: Anteil liegegeld vom Hafengeld derselben Box', () => {
  const { ctx, state } = neu();
  state.buildings['bojenfeld-1'] = 1;
  // Ein Gast ohne Wünsche, der an eine Box und an die Boje passt
  const box = ctx.berths.find((x) => x.kind === 'box' && sim.berthAvailable(state, x) && x.size === 'S');
  assert.ok(box);
  const s = { ...boot(), id: 999, nights: 1, status: 'waiting', wishesMet: 0, wishesTotal: 0 };
  state.boats[999] = s;
  const amBox = sim.berthValue(state, ctx, 999, box.id).fee;
  const anBoje = sim.berthValue(state, ctx, 999, 'BF01').fee;
  assert.ok(amBox > 0);
  assert.equal(anBoje, Math.round(amBox * REGELN.liegegeld));
});

test('Büro und Selbst-Einfahren nehmen die Boje erst, wenn keine Box passt', () => {
  const { ctx, state } = neu();
  state.buildings['bojenfeld-1'] = 1;
  state.boats[999] = { ...boot(), id: 999, nights: 1, status: 'waiting', wishesMet: 0, wishesTotal: 0 };
  const passend = sim.fittingBerths(state, ctx, 999).map((id) => ctx.berthById[id]);
  assert.ok(passend.some((b) => b.kind === 'boje'));
  assert.notEqual(passend[0].kind, 'boje', 'Büro: Box vor Boje');
  assert.notEqual(ctx.berthById[sim.selfBerth(state, ctx, 999)].kind, 'boje', 'selbst: Box vor Boje');
  // Alle Boxen belegt: dann die Boje
  for (const b of ctx.berths) if (b.kind !== 'boje' && sim.berthAvailable(state, b) && sim.isFree(state, b.id)) state.berths[b.id] = 12345;
  assert.equal(ctx.berthById[sim.selfBerth(state, ctx, 999)].kind, 'boje');
  assert.equal(ctx.berthById[sim.fittingBerths(state, ctx, 999)[0]].kind, 'boje');
});

test('Ausbauziel der Region zählt ungebaute Bojen nicht als fehlende Plätze', () => {
  const { ctx, state } = neu({ stage: 4 });
  const ohne = sim.regionGoal(state, ctx);
  state.buildings['bojenfeld-1'] = 1;
  state.buildings['bojenfeld-2'] = 1;
  const mit = sim.regionGoal(state, ctx);
  assert.equal(JSON.stringify(ohne.missing), JSON.stringify(mit.missing));
});

test('Kein Dauerplatz und kein Stammgast-Behalten an einer Boje', () => {
  const { ctx, state } = neu({ stage: 4 });
  state.buildings['bojenfeld-1'] = 1;
  assert.equal(kannDauerplatz(state, ctx, 'BF01').reason, 'boje');
  state.boats[999] = { ...boot(), id: 999, nights: 1, status: 'moored', berthId: 'BF01', besuche: 99 };
  state.berths.BF01 = 999;
  assert.equal(kannBehalten(state, ctx, 'BF01'), false);
});

test('Baumenü: erst Abschnitt 1 ab Stufe 2, dann Abschnitt 2 ab Stufe 4, nur mit Lage im Gelände', () => {
  const { state } = neu({ stage: 1 });
  const alle = BOJENFELD.anzahl;
  assert.equal(angebote({ ...state, stage: 1 }, alle)[0]?.gesperrt, 'ab Ausbaustufe 2');
  const s2 = { ...state, stage: 2, buildings: {} };
  assert.equal(angebote(s2, alle)[0].id, 'bojenfeld-1');
  assert.equal(angebote(s2, 0).length, 0, 'ohne Lage kein Angebot');
  const r = bauen(s2, 'bojenfeld-1', alle, () => true);
  assert.ok(r.ok);
  assert.equal(s2.buildings['bojenfeld-1'], 1);
  assert.equal(angebote(s2, alle).length, 0, 'Abschnitt 2 erst ab Stufe 3 sichtbar');
  const s3 = { ...s2, stage: 3 };
  assert.equal(angebote(s3, alle)[0].gesperrt, 'ab Ausbaustufe 4');
  assert.equal(bauen(s3, 'bojenfeld-2', alle, () => true).grund, 'stufe');
  const s4 = { ...s2, stage: 4 };
  assert.equal(angebote(s4, 6).length, 0, 'nur 6 Bojen Platz: kein zweiter Abschnitt');
  s4.money = 10;
  assert.equal(bauen(s4, 'bojenfeld-2', alle, () => true).grund, 'geld');
  s4.money = 5000;
  assert.ok(bauen(s4, 'bojenfeld-2', alle, () => true).ok);
  assert.equal(angebote(s4, alle).length, 0);
  assert.equal(abschnitte().length, 2);
  assert.equal(ohneLage({ kind: 'boje', id: 'BF07' }, 6), 'boje');
  assert.equal(ohneLage({ kind: 'boje', id: 'BF06' }, 6), null);
});

// Lage im Gelände: auf allen 15 Küsten, je zwei Seeds, Ostsee
test('Lage: auf allen 15 Küsten mindestens ein Abschnitt, tief genug, weg von Stegen, Wartebojen und Ankerfeld', () => {
  const reg = region('ostsee');
  const soll = REGELN.tiefe + Math.min(REGELN.tiefeReserve, ...REGELN.lockern.map((l) => l.tiefeReserve ?? REGELN.tiefeReserve)) + (reg.gelaende?.gezeiten || 0);
  for (let nr = 1; nr <= 15; nr++) {
    for (const seed of [1, 4]) {
      formSetzen(nr, seed);
      const l = bojenfeldLage('ostsee');
      const wo = `Küste ${nr} Seed ${seed}`;
      assert.ok(l.length >= BOJENFELD.abschnitte[0], `${wo}: nur ${l.length} Bojen`);
      assert.equal(l.length % BOJENFELD.abschnitte[0], 0, `${wo}: ganze Abschnitte`);
      const h = hindernisse(reg);
      for (let i = 0; i < l.length; i++) {
        const [px, py] = l[i];
        for (let s = REGELN.abStufe; s <= 6; s++) assert.ok(-punkt(px, py, s, reg).h >= soll, `${wo} BF${i + 1} Stufe ${s} zu flach`);
        for (let j = 0; j < i; j++) assert.ok(Math.hypot(px - l[j][0], py - l[j][1]) >= 16.9, `${wo}: Bojen ${i + 1}/${j + 1} zu eng`);
        assert.ok(py <= REGELN.nordGrenze, `${wo}: im Außenhafen`);
      }
      for (let s = REGELN.abStufe; s <= 6; s++) {
        const w = warteplaetze(s, reg);
        for (const [px, py] of l) {
          for (const b of w.bojen) assert.ok(Math.hypot(b.px - px, b.py - py) >= 18, `${wo}: Warteboje Stufe ${s} zu nah`);
          for (const a of w.ankerbereiche) assert.ok(Math.hypot(a.px - px, a.py - py) >= a.radius + 12, `${wo}: Ankerfeld Stufe ${s} zu nah`);
        }
      }
      assert.ok(h.linien.length > 0);
    }
  }
});

test('Lage ist fest: gleiche Küste und Seed geben dieselben Bojen', () => {
  formSetzen(2, 7);
  const a = JSON.stringify(bojenfeldLage('ostsee'));
  formSetzen(5, 7);
  bojenfeldLage('ostsee');
  formSetzen(2, 7);
  assert.equal(JSON.stringify(bojenfeldLage('ostsee')), a);
});
