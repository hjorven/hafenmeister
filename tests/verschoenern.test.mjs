// Hafen verschönern (P60, features/verschoenern.js, docs/verschoenern.md): Angebote, Kauf, Saison-Regel des
// Anstrichs, Wirkung auf die Bewertung (Hook 'schoen'), Gästebuch, "Als Nächstes".
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { angebote, kaufen, bonus, haengeEin, dekoState, stueckZahl, stueckMax, baumWuchs, ARTEN, FARBEN, REGELN } from '../web/js/features/verschoenern.js';
import { gruendeAusAbreise, PLUS } from '../web/js/ui/gaestebuch-daten.js';

function neu({ stage = 3, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 5, rules: ctx.rules }), ctx, stage);
  state.money = money;
  return { ctx, state };
}

test('Zahlen stehen in economy.js, jede Art hat Abschnitte in steigender Stufe und steigendem Preis', () => {
  assert.deepEqual(ARTEN.sort(), ['baenke', 'baeume', 'kuebel', 'laternen']);
  for (const art of ARTEN) {
    const ab = REGELN.arten[art].abschnitte;
    assert.ok(ab.length >= 2, art);
    for (let i = 1; i < ab.length; i++) {
      assert.ok(ab[i].abStufe > ab[i - 1].abStufe, `${art} Stufen`);
      assert.ok(ab[i].kosten > ab[i - 1].kosten, `${art} Preise`);
    }
    assert.ok(stueckMax(art) <= 12, `${art}: höchstens 12 Stücke`);
  }
  assert.equal(REGELN.anstrich.kosten.length, 6);
  assert.ok(REGELN.anker > 0 && REGELN.anker <= 0.05);
});

test('Stufe 1: Bänke und Kübel kaufbar, Bäume, Laternen und Anstrich gesperrt für Stufe 2', () => {
  const { ctx, state } = neu({ stage: 1 });
  const a = angebote(state, ctx);
  const nach = Object.fromEntries(a.map((x) => [x.art, x]));
  assert.equal(nach.baenke.gesperrt, null);
  assert.equal(nach.kuebel.gesperrt, null);
  assert.equal(nach.baeume.gesperrt, 'ab Ausbaustufe 2');
  assert.equal(nach.laternen.gesperrt, 'ab Ausbaustufe 2');
  assert.equal(nach.anstrich.gesperrt, 'ab Ausbaustufe 2');
  assert.equal(kaufen(state, ctx, 'baeume').grund, 'stufe');
  assert.equal(kaufen(state, ctx, 'anstrich', 'friesenblau').grund, 'stufe');
});

test('Kauf zählt als Ausgabe, schaltet den nächsten Abschnitt frei, endet nach dem letzten', () => {
  const { ctx, state } = neu({ stage: 6 });
  const geld = state.money;
  const r = kaufen(state, ctx, 'baenke');
  assert.ok(r.ok);
  assert.equal(state.money, geld - REGELN.arten.baenke.abschnitte[0].kosten);
  assert.equal(stueckZahl(state, 'baenke'), REGELN.arten.baenke.abschnitte[0].stueck);
  assert.equal(angebote(state, ctx).find((x) => x.art === 'baenke').nr, 2);
  while (kaufen(state, ctx, 'baenke').ok);
  assert.equal(stueckZahl(state, 'baenke'), stueckMax('baenke'));
  assert.equal(angebote(state, ctx).find((x) => x.art === 'baenke'), undefined, 'alle Abschnitte gebaut');
  assert.equal(kaufen(state, ctx, 'baenke').grund, 'unbekannt');
});

test('Zu wenig Geld: nichts ändert sich', () => {
  const { ctx, state } = neu({ stage: 3, money: 10 });
  const vorher = structuredClone(state.modules?.verschoenern ?? {});
  assert.equal(kaufen(state, ctx, 'baenke').grund, 'geld');
  assert.equal(state.money, 10);
  assert.deepEqual(state.modules?.verschoenern ?? {}, vorher);
});

test('Abschnitt der nächsten Stufe steht gesperrt da, der übernächsten noch nicht', () => {
  const { ctx, state } = neu({ stage: 2 });
  kaufen(state, ctx, 'baenke');
  const b = angebote(state, ctx).find((x) => x.art === 'baenke');
  assert.equal(b.gesperrt, 'ab Ausbaustufe 3');
  const { ctx: c1, state: s1 } = neu({ stage: 1 });
  kaufen(s1, c1, 'baenke');
  assert.equal(angebote(s1, c1).find((x) => x.art === 'baenke'), undefined, 'Abschnitt ab Stufe 3 erst ab Stufe 2 zeigen');
});

test('Anstrich: nur bekannte Farbe, einmal je Saison, nur der erste hebt die Bewertung', () => {
  const { ctx, state } = neu({ stage: 3 });
  assert.equal(kaufen(state, ctx, 'anstrich', 'pink').grund, 'farbe');
  assert.equal(kaufen(state, ctx, 'anstrich', '__proto__').grund, 'farbe');
  const geld = state.money;
  assert.ok(kaufen(state, ctx, 'anstrich', 'friesenblau').ok);
  assert.equal(state.money, geld - REGELN.anstrich.kosten[2]);
  assert.equal(state.modules.verschoenern.anstrich, 'friesenblau');
  assert.equal(bonus(state), REGELN.anstrich.anker);
  const a = angebote(state, ctx).find((x) => x.art === 'anstrich');
  assert.equal(a.gesperrt, 'nächste Saison wieder');
  assert.equal(a.anker, 0);
  assert.equal(kaufen(state, ctx, 'anstrich', 'kalkweiss').grund, 'saison');
  // nächste Saison
  state.day += ctx.rules.seasonDays + ctx.rules.winterDays;
  assert.equal(angebote(state, ctx).find((x) => x.art === 'anstrich').gesperrt, null);
  assert.ok(kaufen(state, ctx, 'anstrich', 'kalkweiss').ok);
  assert.equal(state.modules.verschoenern.anstrich, 'kalkweiss');
  assert.equal(bonus(state), REGELN.anstrich.anker, 'neuer Anstrich: keine zweite Wirkung');
});

test('Wirkung: je Abschnitt anker auf jede Bewertung, als eigener Teil "schoen", im Gästebuch', () => {
  const { ctx, state } = neu({ stage: 6 });
  const ab = haengeEin((name, fn) => sim.addHook(ctx, name, fn), () => state);
  const boot = { wishes: [], wishesTotal: 0, wishesMet: 0, berthId: null };
  const ohne = sim.ratingParts(ctx, boot);
  assert.equal(ohne.schoen, 0);
  kaufen(state, ctx, 'baenke');
  kaufen(state, ctx, 'kuebel');
  kaufen(state, ctx, 'anstrich', FARBEN[0].id);
  const mit = sim.ratingParts(ctx, boot);
  const soll = 2 * REGELN.anker + REGELN.anstrich.anker;
  assert.ok(Math.abs(mit.schoen - soll) < 1e-9, `${mit.schoen} statt ${soll}`);
  assert.ok(mit.value >= ohne.value);
  const g = gruendeAusAbreise({ parts: mit });
  assert.ok(g.plus.some((p) => p.key === 'schoen'), JSON.stringify(g.plus));
  assert.equal(PLUS.schoen, 'schöner Hafen');
  // Alles gebaut: höchstens 0,5 Anker
  for (const art of ARTEN) while (kaufen(state, ctx, art).ok);
  assert.ok(bonus(state) <= 0.5, String(bonus(state)));
  ab();
  assert.equal(sim.ratingParts(ctx, boot).schoen, 0, 'Hook wieder ausgehängt');
});

test('Bäume wachsen nach dem Pflanzen über baumWachsTage', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.day = 10;
  kaufen(state, ctx, 'baeume');
  assert.equal(state.modules.verschoenern.baumTage[0], 10);
  assert.equal(baumWuchs(state, 0), 0.4);
  state.day = 10 + REGELN.baumWachsTage;
  assert.equal(baumWuchs(state, 0), 1);
  assert.equal(baumWuchs(state, 5), 1, 'ohne Pflanztag ausgewachsen');
});

test('Spielstand: kaputte Werte werden aufgeräumt', () => {
  const state = { modules: { verschoenern: { baenke: 99, kuebel: -3, baeume: 'x', laternen: 1.7, anstrich: 'neon', baumTage: null } } };
  const m = dekoState(state);
  assert.equal(m.baenke, REGELN.arten.baenke.abschnitte.length);
  assert.equal(m.kuebel, 0);
  assert.equal(m.baeume, 0);
  assert.equal(m.laternen, 1);
  assert.equal(m.anstrich, null);
  assert.deepEqual(m.baumTage, []);
});
