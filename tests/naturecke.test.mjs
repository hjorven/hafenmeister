// Naturecke am Schilf (P52, F39): features/naturecke-regeln.js und render/landschaft/naturecke-lage.js.
// Beschreibung: docs/naturecke.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { REGELN, angebote, entscheiden, wahl, haengeEin, parkplatzEinnahme, ankerBonus } from '../web/js/features/naturecke-regeln.js';
import { gruendeAusAbreise } from '../web/js/ui/gaestebuch-daten.js';
import { waehleSchritt, leer } from '../web/js/ui/bauen-rat.js';
import { formSetzen } from '../web/js/render/landschaft/formen.js';
import { punkt, hafenAbstand } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { naturLage, hindernisse, frei, imSchilf, MASS, STUFEN } from '../web/js/render/landschaft/naturecke-lage.js';
import { bojenfeldLage } from '../web/js/render/landschaft/bojenfeld-lage.js';

function neu({ stage = 2, money = 100000 } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed: 7, rules: ctx.rules }), ctx, stage);
  state.money = money;
  return { ctx, state };
}

test('Zahlen: zwei Angebote, Kosten, Bonus und Einnahme je Stufe', () => {
  assert.ok(REGELN);
  assert.ok(REGELN.schuetzen.kosten > 0 && REGELN.bebauen.kosten > REGELN.schuetzen.kosten);
  assert.ok(REGELN.schuetzen.anker > 0 && REGELN.schuetzen.anker <= 0.25);
  assert.equal(REGELN.bebauen.grund.length, 7, 'je Stufe 0 bis 6');
  for (let s = REGELN.abStufe + 1; s <= 6; s++) assert.ok(REGELN.bebauen.grund[s] >= REGELN.bebauen.grund[s - 1]);
});

test('Angebote: in Stufe 1 gesperrt, ab Stufe 2 offen, ohne Schilf an der Küste keine', () => {
  const s1 = neu({ stage: 1 });
  const a1 = angebote(s1.state);
  assert.equal(a1.length, 2);
  assert.ok(a1.every((a) => a.gesperrt === `ab Ausbaustufe ${REGELN.abStufe}`));
  assert.equal(entscheiden(s1.state, 'schuetzen').grund, 'stufe');
  const s2 = neu({ stage: 2 });
  assert.deepEqual(angebote(s2.state).map((a) => [a.id, a.gesperrt]), [['schuetzen', null], ['bebauen', null]]);
  assert.deepEqual(angebote(s2.state, false), [], 'ohne Lage nichts im Baumenü');
  assert.equal(entscheiden(s2.state, 'schuetzen', undefined, false).grund, 'unbekannt');
});

test('Entscheiden kostet Geld, gilt für immer, das andere Angebot verschwindet', () => {
  const { state } = neu({ stage: 2, money: 1000 });
  const r = entscheiden(state, 'schuetzen');
  assert.ok(r.ok);
  assert.equal(r.wahl, 'schutz');
  assert.equal(state.money, 1000 - REGELN.schuetzen.kosten);
  assert.equal(wahl(state), 'schutz');
  assert.deepEqual(angebote(state), []);
  assert.equal(entscheiden(state, 'bebauen').grund, 'schon', 'nicht umkehrbar');
  assert.equal(entscheiden(state, 'schuetzen').grund, 'schon');
  assert.equal(wahl(state), 'schutz');
  // Laden: die Wahl bleibt
  const geladen = deserialize(serialize(state));
  assert.equal(wahl(geladen), 'schutz');
  assert.deepEqual(angebote(geladen), []);
});

test('Zu wenig Geld: nichts passiert', () => {
  const { state } = neu({ stage: 2, money: REGELN.bebauen.kosten - 1 });
  assert.equal(entscheiden(state, 'bebauen').grund, 'geld');
  assert.equal(wahl(state), null);
  assert.equal(state.money, REGELN.bebauen.kosten - 1);
  assert.equal(entscheiden(state, 'gibtsnicht').grund, 'unbekannt');
});

test('Bebaut: der Parkplatz bringt jeden Abend Geld (Sonstiges, Parkplatz), im Winter nichts', () => {
  const { ctx, state } = neu({ stage: 3 });
  const ab = haengeEin((name, fn) => sim.addHook(ctx, name, fn), () => state);
  assert.equal(parkplatzEinnahme(state, 10), 0, 'ohne Bau nichts');
  assert.ok(entscheiden(state, 'bebauen').ok);
  assert.equal(parkplatzEinnahme(state, 0), REGELN.bebauen.grund[3]);
  assert.equal(parkplatzEinnahme(state, 5), REGELN.bebauen.grund[3] + 5 * REGELN.bebauen.jeGast);
  // Ein ganzer Tag: Einnahme kommt am Abend
  const geld = state.money;
  let einnahme = 0;
  let abend = false;
  for (let i = 0; i < 4000 && !abend; i++) {
    const ev = sim.tick(state, ctx, 1);
    for (const e of ev) { if (e.type === 'parkplatz') einnahme += e.amount; if (e.type === 'evening') abend = true; }
  }
  assert.ok(abend, 'Abend erreicht');
  assert.ok(einnahme >= REGELN.bebauen.grund[3], `Parkplatz zahlt am Abend (${einnahme})`);
  assert.ok(state.money >= geld + einnahme - 1);
  const h = state.stats.heute;
  assert.equal(h.details?.sonstiges?.parkplatz, einnahme);
  // Winter: keine Einnahme
  const w = neu({ stage: 3 });
  w.state.modules.naturecke = { wahl: 'bebaut', tag: 1 };
  w.state.day = ctx.rules.seasonDays + 2;
  const ev = [];
  let gebucht = 0;
  const hooks = [];
  haengeEin((name, fn) => { hooks.push([name, fn]); return () => {}; }, () => w.state);
  for (const [name, fn] of hooks) if (name === 'evening') fn({ state: w.state, ctx, boats: [], events: ev, addIncome: (a) => { gebucht += a; } });
  assert.equal(gebucht, 0);
  ab();
});

test('Geschützt: Gäste, die einen Abend im Hafen lagen, bewerten besser, Gästebuch nennt den Abend am Schilf', () => {
  const { ctx, state } = neu({ stage: 2 });
  const ab = haengeEin((name, fn) => sim.addHook(ctx, name, fn), () => state);
  const box = ctx.berths.find((b) => b.kind === 'box' && sim.berthAvailable(state, b));
  const boot = { id: 'g1', berthId: box.id, wishes: [], wishesMet: 0, wishesTotal: 0, status: 'moored' };
  const ohne = sim.ratingParts(ctx, boot);
  assert.ok(entscheiden(state, 'schuetzen').ok);
  assert.equal(sim.ratingParts(ctx, boot).comfort, ohne.comfort, 'erst nach einem Abend');
  boot.natur = true;
  const mit = sim.ratingParts(ctx, boot);
  assert.equal(Math.round((mit.comfort - ohne.comfort) * 100) / 100, REGELN.schuetzen.anker);
  assert.equal(mit.natur, true);
  const g = gruendeAusAbreise({ parts: mit });
  assert.ok(g.plus.some((p) => p.key === 'natur' && p.wert === REGELN.schuetzen.anker));
  assert.ok(!g.plus.some((p) => p.key === 'komfort'), 'der Bonus zählt nicht doppelt als bequemer Platz');
  assert.equal(ankerBonus({ modules: { naturecke: { wahl: 'bebaut' } } }, boot), 0, 'bebaut: kein Bonus');
  // Abend: liegende Gäste bekommen boat.natur
  let abend = false;
  for (let i = 0; i < 4000 && !abend; i++) abend = sim.tick(state, ctx, 1).some((e) => e.type === 'evening');
  assert.ok(abend, 'Abend erreicht');
  const liegen = Object.values(state.boats).filter((b) => b.status === 'moored' && !b.stationed);
  assert.ok(liegen.length > 0, 'am Abend liegen Gäste');
  assert.ok(liegen.every((b) => b.natur), 'alle liegenden Gäste erlebten den Abend am Schilf');
  ab();
});

test('Als Nächstes schlägt die Naturecke nie vor (Entscheidung des Spielers)', () => {
  const e = [
    { key: 'naturecke:schuetzen', art: 'hafen', kosten: 300, gesperrt: null, keinRat: true, nutzen: [] },
    { key: 'naturecke:bebauen', art: 'hafen', kosten: 900, gesperrt: null, keinRat: true, nutzen: [] },
  ];
  const r = waehleSchritt({ geld: 5000, eintraege: e, bedarf: leer(), stufe: null, region: null, geschenk: null });
  assert.ok(!r || !String(r.ziel ?? '').startsWith('naturecke'));
});

// ---------------------------------------------------------------- Lage

function pruefeLage(l, reg, text) {
  assert.ok(l, `${text}: Schilfgürtel gefunden`);
  assert.ok(l.schilf.length >= MASS.minPunkte, `${text}: genug Schilf (${l.schilf.length})`);
  const h = hindernisse(reg, { steg: 9.9, platz: 8.9, korridor: 7.9, boje: 17.9, anker: 9.9, prick: 7.9, ufer: 9.9, runde: 9.9, bojenfeld: 19.9, strand: 11.9, service: 4.9 });
  for (const [px, py] of l.schilf) {
    for (const s of STUFEN) {
      const t = -punkt(px, py, s, reg).h;
      assert.ok(t >= MASS.tiefe[0] - 1e-9 && t <= MASS.tiefe[1] + 1e-9, `${text}: Schilf bei ${px},${py} in Stufe ${s} ${t.toFixed(2)} m tief`);
    }
    assert.ok(hafenAbstand(px, py, 6) >= MASS.hafenAbstand, `${text}: Schilf auf der Hafenfläche`);
    assert.ok(frei(px, py, h), `${text}: Schilf bei ${px},${py} zu nah an Stegen, Wegen oder Bojen`);
  }
  // Ufer an Land in jeder Stufe, Bohlenweg beginnt dort
  for (const s of STUFEN) assert.ok(punkt(l.ufer[0], l.ufer[1], s, reg).h > 0, `${text}: Ufer in Stufe ${s} an Land`);
  // Bojenfeld hält Abstand (beide Abschnitte)
  for (const [bx, by] of bojenfeldLage(reg)) for (const [px, py] of l.schilf) assert.ok(Math.hypot(bx - px, by - py) >= 19.9, `${text}: Schilf am Bojenfeld`);
  // imSchilf findet die eigenen Punkte
  const [px, py] = l.schilf[0];
  assert.ok(imSchilf(l, px * 0.62, -py * 0.62));
  assert.ok(!imSchilf(l, (px + 200) * 0.62, -py * 0.62));
}

test('Lage: alle 15 Küsten (Ostsee, Seeds 1 und 2) haben einen Schilfgürtel nahe am Hafen', { timeout: 240_000 }, () => {
  const reg = region('ostsee');
  for (let nr = 1; nr <= 15; nr++) for (const seed of [1, 2]) {
    formSetzen(nr, seed);
    const l = naturLage(reg);
    pruefeLage(l, reg, `Küste ${nr} Seed ${seed}`);
    // Inselhafen (10) Seed 2: nächster Platz im Spielbereich rund 470 Einheiten (290 m) weit
    assert.ok(Math.hypot(l.mitte[0] + 60, l.mitte[1] - 60) < 500, `Küste ${nr} Seed ${seed}: nah am Hafen`);
    assert.strictEqual(naturLage(reg), l, 'zwischengespeichert');
  }
});

test('Lage: Nordsee (alle 15 Küsten, Seed 1)', { timeout: 240_000 }, () => {
  const reg = region('nordsee');
  let ohne = 0;
  for (let nr = 1; nr <= 15; nr++) {
    formSetzen(nr, 1);
    const l = naturLage(reg);
    if (!l) { ohne++; continue; }
    pruefeLage(l, reg, `Nordsee Küste ${nr}`);
  }
  // Die Nordsee kommt erst mit P57 ins Spiel: Wo es keinen Platz gibt, fehlen nur die Einträge im Baumenü
  assert.ok(ohne <= 3, `Nordsee ohne Schilfgürtel: ${ohne} Küsten`);
});

test('Lage: alle Stegbilder auf Küste 1 und 4', { timeout: 240_000 }, () => {
  const reg = region('ostsee');
  for (const nr of [1, 4]) {
    formSetzen(nr, 1);
    for (let b = 1; b <= STEGBILDER.varianten.length; b++) {
      stegbildSetzen(HAFEN, b);
      pruefeLage(naturLage(reg), reg, `Küste ${nr} Stegbild ${b}`);
    }
  }
});
