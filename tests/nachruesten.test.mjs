// Stege nachrüsten (features/nachruesten.js, docs/nachruesten.md): Angebote, Preis, Kauf, Wirkung.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { angebote, kaufen, hat, ankerBonus, haengeEin, platzArten, preis, betroffenePlaetze, ARTEN } from '../web/js/features/nachruesten.js';
import { waehleSchritt } from '../web/js/ui/bauen-rat.js';

function neu({ stage = 3, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 5, rules: ctx.rules }), ctx, stage);
  state.money = money;
  return { ctx, state };
}

test('Zahlen stehen in economy.js: Fingerstege und Laternen', () => {
  assert.equal(ARTEN.finger.nurArt, 'box');
  assert.equal(ARTEN.finger.anker, ECONOMY.platzarten.finger.rufBonus, 'Fingersteg wirkt wie die Platzart finger');
  assert.ok(ARTEN.licht.anker > 0 && ARTEN.licht.anker < ARTEN.finger.anker);
  assert.ok(ARTEN.licht.abStufe <= ARTEN.finger.abStufe);
});

test('Stufe 1: nichts zu kaufen, Laternen erscheinen gesperrt für Stufe 2', () => {
  const { ctx, state } = neu({ stage: 1 });
  const a = angebote(state, ctx);
  assert.ok(a.length > 0);
  assert.ok(a.every((x) => x.art === 'licht' && x.gesperrt === 'ab Ausbaustufe 2'), JSON.stringify(a));
  assert.equal(kaufen(state, ctx, 'licht', a[0].steg).grund, 'stufe');
});

test('Stufe 3: Fingerstege nur an Stegen mit Heckpfahl-Boxen, Laternen an jedem Gaststeg', () => {
  const { ctx, state } = neu({ stage: 3 });
  const a = angebote(state, ctx);
  const finger = a.filter((x) => x.art === 'finger').map((x) => x.steg);
  const licht = a.filter((x) => x.art === 'licht').map((x) => x.steg);
  for (const steg of finger) assert.ok(betroffenePlaetze(state, ctx, 'finger', steg).every((b) => b.kind === 'box'));
  assert.ok(finger.includes('A') && finger.includes('B'), finger.join());
  assert.ok(!finger.includes('F'), 'Fischersteg ist fest vergeben');
  for (const s of finger) assert.ok(licht.includes(s));
  assert.ok(a.every((x) => !x.gesperrt));
  // Preis = grund + jePlatz je Klasse, auf 10 € gerundet
  const fa = a.find((x) => x.art === 'finger' && x.steg === 'A');
  assert.equal(fa.kosten, preis(ARTEN.finger, betroffenePlaetze(state, ctx, 'finger', 'A')));
  assert.equal(fa.kosten % 10, 0);
});

test('Kauf kostet Geld, zählt als Ausgabe, geht nur einmal je Steg', () => {
  const { ctx, state } = neu({ stage: 3, money: 5000 });
  const a = angebote(state, ctx).find((x) => x.art === 'finger' && x.steg === 'A');
  const r = kaufen(state, ctx, 'finger', 'A');
  assert.ok(r.ok);
  assert.equal(state.money, 5000 - a.kosten);
  assert.ok(hat(state, 'finger', 'A'));
  assert.equal(kaufen(state, ctx, 'finger', 'A').grund, 'schon');
  assert.ok(!angebote(state, ctx).some((x) => x.art === 'finger' && x.steg === 'A'));
  assert.ok(angebote(state, ctx).some((x) => x.art === 'licht' && x.steg === 'A'), 'Laternen an A bleiben im Angebot');
  state.money = 10;
  assert.equal(kaufen(state, ctx, 'licht', 'A').grund, 'geld');
  assert.equal(state.money, 10);
  assert.equal(kaufen(state, ctx, 'licht', 'Q').grund, 'unbekannt');
});

test('Wirkung: Gäste am nachgerüsteten Steg bewerten besser, Stirnplätze ohne Finger', () => {
  const { ctx, state } = neu({ stage: 3 });
  const box = ctx.berths.find((b) => b.jetty === 'B' && b.kind === 'box' && sim.berthAvailable(state, b));
  const stirn = ctx.berths.find((b) => b.jetty === 'B' && b.kind === 'stirn' && sim.berthAvailable(state, b));
  const andere = ctx.berths.find((b) => b.jetty === 'A' && sim.berthAvailable(state, b));
  assert.ok(box && stirn && andere);
  assert.ok(kaufen(state, ctx, 'finger', 'B').ok);
  assert.equal(ankerBonus(state, ctx, { berthId: box.id }), ARTEN.finger.anker);
  assert.equal(ankerBonus(state, ctx, { berthId: stirn.id }), 0);
  assert.equal(ankerBonus(state, ctx, { berthId: andere.id }), 0);
  assert.ok(kaufen(state, ctx, 'licht', 'B').ok);
  assert.equal(Math.round(ankerBonus(state, ctx, { berthId: box.id }) * 100) / 100, ARTEN.finger.anker + ARTEN.licht.anker);
  assert.equal(ankerBonus(state, ctx, { berthId: stirn.id }), ARTEN.licht.anker);
  assert.deepEqual(platzArten(state, box), ['finger', 'licht']);
  assert.equal(ankerBonus(state, ctx, { berthId: null }), 0);
});

test('Über den Hook rating zählt der Bonus in der Bewertung (Bauteil comfort) und lässt sich abhängen', () => {
  const { ctx, state } = neu({ stage: 3 });
  const box = ctx.berths.find((b) => b.jetty === 'A' && b.kind === 'box' && sim.berthAvailable(state, b));
  const boot = { berthId: box.id, wishes: ['wc'], wishesMet: 1, wishesTotal: 2 };
  const ohne = sim.ratingParts(ctx, boot);
  const ab = haengeEin((name, fn) => sim.addHook(ctx, name, fn), () => state);
  assert.equal(sim.ratingParts(ctx, boot).comfort, ohne.comfort, 'ohne Kauf kein Bonus');
  assert.ok(kaufen(state, ctx, 'finger', 'A').ok);
  const mit = sim.ratingParts(ctx, boot);
  assert.equal(Math.round((mit.comfort - ohne.comfort) * 100) / 100, ARTEN.finger.anker);
  assert.ok(mit.value > ohne.value);
  ab();
  assert.equal(sim.ratingParts(ctx, boot).comfort, ohne.comfort);
});

test('Boxen späterer Stufen am gleichen Steg bekommen den Finger gleich mit', () => {
  const { ctx, state } = neu({ stage: 2 });
  state.stage = 3;
  const vorher = betroffenePlaetze(state, ctx, 'finger', 'A').length;
  assert.ok(kaufen(state, ctx, 'finger', 'A').ok);
  // Eine Box von A, die erst in einer späteren Stufe liegt (oder bei gleichem Stand: irgendeine)
  const spaeter = ctx.berths.find((b) => b.jetty === 'A' && b.kind === 'box' && !sim.berthAvailable(state, b)) ?? ctx.berths.find((b) => b.jetty === 'A' && b.kind === 'box');
  assert.ok(vorher > 0);
  assert.equal(ankerBonus(state, ctx, { berthId: spaeter.id }), ARTEN.finger.anker);
});

test('Spielstand: Nachrüstungen überleben JSON, alte Stände ohne Eintrag gehen', () => {
  const { ctx, state } = neu({ stage: 3 });
  assert.ok(kaufen(state, ctx, 'licht', 'A').ok);
  const geladen = JSON.parse(JSON.stringify(state));
  assert.ok(hat(geladen, 'licht', 'A'));
  delete geladen.modules.nachruesten;
  assert.equal(hat(geladen, 'licht', 'A'), false);
  assert.ok(angebote(geladen, ctx).some((x) => x.art === 'licht' && x.steg === 'A'));
});

test('Als Nächstes: Nachrüsten zählt nicht als neuer Liegeplatz, hilft aber beim Ruf', () => {
  const e = (key, extra) => ({ key, name: key, kosten: 500, gesperrt: null, nutzen: [], ...extra });
  const eintraege = [
    e('nachruesten:finger:A', { art: 'steg', nachruesten: 'finger', hebtNote: true, name: 'Fingerstege an Steg A' }),
    e('hafen:stufe', { art: 'hafen', kosten: 9000 }),
  ];
  const bedarf = { weg: 3, offen: {}, belegt: 10, plaetze: 10, abend: true };
  const stufe = { goal: { name: 'Ausbau', guests: 10, reputation: 4, cost: 9000 }, ok: false, guests: 10, reputation: 3.5, missing: ['reputation'] };
  const r = waehleSchritt({ geld: 1000, eintraege, bedarf, stufe });
  assert.equal(r.ziel, 'nachruesten:finger:A');
  assert.match(r.text, /Ruf 4,0 nötig/);
  assert.ok(!/Plätze|Platz\b/.test(r.text), r.text);
});
