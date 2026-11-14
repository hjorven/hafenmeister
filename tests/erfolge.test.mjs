// Erfolge (Roadmap P22, docs/erfolge.md): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, deserialize, serialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { spiel } from '../tools/balance.mjs';
import * as E from '../web/js/features/erfolge-daten.js';

const Z = ECONOMY.erfolge;

function hilfe(state, ctx) {
  return {
    ...E.hilfsdaten(state, { types: ctx.types, ruf: sim.reputation(state) }),
    voll: () => E.ausgebuchtJetzt(state, ctx),
    abend: () => state.phase === 'evening',
  };
}

/** Eine ganze Partie (geschickter Spieler aus tools/balance.mjs) bis zum Abschluss der letzten Stufe. */
function partie(seed) {
  const tag = {};
  let st = null;
  const res = spiel(seed, 'geschickt', {
    maxTage: 900,
    beobachter: (state, ctx, events) => {
      st = state;
      const h = hilfe(state, ctx);
      E.zaehle(state, events, h);
      for (const e of E.pruefen(state, h)) tag[e.id] = state.day;
    },
  });
  return { res, tag, state: st };
}

// Diese Erfolge kommen aus Modulen der Oberfläche (Tagesziele, Stammgäste, Ereignisse) oder erst im
// Endlosspiel nach dem Abschluss; sie werden unten einzeln geprüft.
const NICHT_IN_PARTIE = ['tagesziele', 'wochenziel', 'stammgast', 'stammgaeste', 'sturm', 'gesamt-2', 'region', 'fuenf-anker'];

test('Liste: eindeutige ids, gültige Gruppen und Dinge, Schilder für Stufe 2 bis 6', () => {
  const ids = E.ERFOLGE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of E.ERFOLGE) {
    assert.ok(E.GRUPPEN[e.gruppe], `${e.id}: Gruppe`);
    assert.ok(['wimpel', 'pokal', 'schild'].includes(e.ding), `${e.id}: Ding`);
    assert.ok(e.titel && e.text, `${e.id}: Texte`);
  }
  assert.deepEqual(E.ERFOLGE.filter((e) => e.ding === 'schild').map((e) => e.stufeSchild), [2, 3, 4, 5, 6]);
  assert.ok(E.ERFOLGE.filter((e) => e.ding === 'pokal').length <= 7, 'Pokaltreppe hat 7 Plätze');
  assert.ok(E.ERFOLGE.filter((e) => e.ding === 'wimpel').length <= 24, 'Erfolgsmast hat 24 Plätze');
});

test('jeder Erfolg ist in einer simulierten Partie erreichbar, in sinnvoller Reihenfolge', () => {
  for (const seed of [1, 2]) {
    const { res, tag, state } = partie(seed);
    assert.ok(res.ende, `Seed ${seed}: Partie bis zum Ende gespielt`);
    for (const e of E.ERFOLGE) {
      if (NICHT_IN_PARTIE.includes(e.id)) continue;
      assert.ok(tag[e.id], `Seed ${seed}: ${e.id} erreicht`);
    }
    // nicht alles am Anfang: die großen Erfolge brauchen ihre Zeit
    assert.ok(tag['erste-leine'] <= 2);
    assert.ok(tag['gaeste-1'] < tag['gaeste-2']);
    assert.ok(tag['tag-1'] < tag['tag-2']);
    assert.ok(tag['logbuch-1'] < tag['logbuch-2'] && tag['logbuch-2'] < tag['logbuch-3']);
    assert.ok(tag['stufe-2'] < tag['stufe-3'] && tag['stufe-5'] < tag['stufe-6']);
    assert.ok(tag['ausgebucht'] > 10, 'ausgebucht nicht schon am alten Steg');
    assert.ok(tag['tag-2'] > 100 && tag['gaeste-2'] > 60, 'Pokale kommen spät');
    // Eingetragen mit Tag und Stufe
    const m = E.erfolgeState(state);
    assert.equal(m.erreicht['stufe-3'].stufe, 3);
    assert.equal(m.erreicht['stufe-3'].tag, tag['stufe-3']);
    // Millionär ist im Endlosspiel erreichbar: die Einnahmen der letzten Stufe reichen in absehbarer Zeit
    assert.ok(state.stats.totalIncome > Z.gesamt[1] * 0.4, 'mindestens 40 % des Millionen-Ziels bis zum Abschluss');
  }
});

test('Erfolge aus der Oberfläche: Tagesziele, Wochenziel, Sturm, Stammgäste, Abschluss', () => {
  const state = createState({ seed: 1 });
  const h = { fortschritt: null, ruf: 3 };
  for (let i = 0; i < Z.tagesziele - 1; i++) E.zaehleExtra(state, 'ziel');
  assert.equal(E.pruefen(state, h).some((e) => e.id === 'tagesziele'), false);
  E.zaehleExtra(state, 'ziel');
  E.zaehleExtra(state, 'woche');
  E.zaehleExtra(state, 'sturm');
  const neu = E.pruefen(state, h).map((e) => e.id);
  assert.ok(neu.includes('tagesziele') && neu.includes('wochenziel') && neu.includes('sturm'));
  state.modules.stamm = { liste: Array.from({ length: Z.stammgaeste[1] }, (_, i) => ({ stammId: i })) };
  assert.deepEqual(E.pruefen(state, h).map((e) => e.id).sort(), ['stammgaeste', 'stammgast']);
  E.zaehle(state, [{ type: 'regionDone', region: 'ostsee', day: 5 }]);
  assert.deepEqual(E.pruefen(state, h).map((e) => e.id), ['region']);
});

test('5 Sterne und Woche nur Lob zählen die schlechteste Bewertung des Abends', () => {
  const state = createState({ seed: 1 });
  const abend = (ratings) => [
    ...ratings.map((rating, i) => ({ type: 'departed', boatId: i, rating })),
    { type: 'dayEnd', bericht: { abgereist: ratings.length, bewertung: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null } },
  ];
  // Schnitt 4,5, aber einer gibt 3: keine Serie
  E.zaehle(state, abend([5, 5, 5, 3]));
  assert.equal(E.erfolgeState(state).z.serie, 0);
  for (let i = 0; i < Z.lob - 1; i++) E.zaehle(state, abend([4, 4.5]));
  E.zaehle(state, abend([]));   // Tag ohne Abreise unterbricht nicht
  assert.equal(E.erfolgeState(state).z.serie, Z.lob - 1);
  assert.equal(E.pruefen(state, {}).some((e) => e.id === 'nur-lob'), false);
  E.zaehle(state, abend([5, 5]));
  const neu = E.pruefen(state, {}).map((e) => e.id);
  assert.ok(neu.includes('nur-lob'), 'Serie voll');
  assert.ok(neu.includes('fuenf-anker'), 'zwei Gäste mit 5 Sternen');
  // Ein einzelner Gast mit 5 Sternen reicht nicht
  const s2 = createState({ seed: 2 });
  E.zaehle(s2, abend([5]));
  assert.equal(E.pruefen(s2, {}).some((e) => e.id === 'fuenf-anker'), false);
  assert.equal(E.erfolgeState(s2).z.tiefst, undefined, 'Merker des Abends ist danach weg');
});

test('ausgebucht zählt erst ab genug Gastboxen und nur, wenn alle belegt sind', () => {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const klein = createState({ seed: 3, rules: ctx.rules });
  const gast = (s) => sim.availableBerths(s, ctx).filter((b) => !b.reserved);
  for (const b of gast(klein)) klein.berths[b.id] = 'x';
  assert.ok(gast(klein).length < Z.ausgebuchtAb);
  assert.equal(E.ausgebuchtJetzt(klein, ctx), false, 'alter Steg mit wenigen Boxen zählt nicht');
  const gross = sim.applyTestStage(createState({ seed: 3, rules: ctx.rules }), ctx, 3);
  const boxen = gast(gross);
  assert.ok(boxen.length >= Z.ausgebuchtAb);
  for (const b of boxen.slice(1)) gross.berths[b.id] ||= 'x';
  assert.equal(E.ausgebuchtJetzt(gross, ctx), sim.isFree(gross, boxen[0].id) ? false : true);
  for (const b of boxen) gross.berths[b.id] ||= 'x';
  assert.equal(E.ausgebuchtJetzt(gross, ctx), true);
  // nur abends: am Tag zählt es nicht
  E.zaehle(gross, [{ type: 'moored', boatId: 1 }], { voll: () => true, abend: () => false });
  assert.equal(E.erfolgeState(gross).z.ausgebucht, undefined);
  E.zaehle(gross, [{ type: 'evening' }], { voll: () => true });
  assert.equal(E.erfolgeState(gross).z.ausgebucht, 1);
});

test('einmal erreicht bleibt erreicht, auch über Speichern und Laden; Unsinn im Spielstand wird gesäubert', () => {
  const state = createState({ seed: 4 });
  state.stage = 3;
  const neu = E.pruefen(state, {}).map((e) => e.id);
  assert.ok(neu.includes('stufe-2') && neu.includes('stufe-3') && neu.includes('grundstein'));
  assert.deepEqual(E.pruefen(state, {}), [], 'kein zweites Mal');
  const geladen = deserialize(serialize(state));
  assert.deepEqual(E.erfolgeState(geladen).erreicht, E.erfolgeState(state).erreicht);
  geladen.stage = 1;   // auch wenn die Bedingung nicht mehr gilt
  assert.deepEqual(E.pruefen(geladen, {}), []);
  assert.ok(E.dinge(geladen).schilder.includes(3));

  const kaputt = createState({ seed: 5 });
  kaputt.modules.erfolge = { erreicht: { 'stufe-2': 7, quatsch: 'x' }, z: { passgenau: -3, ziele: 'viel' }, neu: [1, 'stufe-2'] };
  const m = E.erfolgeState(kaputt);
  assert.deepEqual(m.erreicht['stufe-2'], { tag: null, stufe: null });
  assert.equal(m.erreicht.quatsch, undefined);
  assert.equal(m.z.passgenau, 0);
  assert.equal(m.z.ziele, 0);
  assert.deepEqual(m.neu, ['stufe-2']);
});

test('Ansicht und Dinge im Hafen', () => {
  const state = createState({ seed: 6 });
  state.stage = 2;
  state.guests = Z.gaeste[0];
  E.pruefen(state, {});
  const a = E.ansicht(state, {});
  assert.deepEqual(a.map((g) => g.gruppe), Object.keys(E.GRUPPEN));
  const g = a.find((x) => x.gruppe === 'gaeste').erfolge;
  assert.ok(g.find((e) => e.id === 'gaeste-1').erreicht);
  const zwei = g.find((e) => e.id === 'gaeste-2');
  assert.equal(zwei.erreicht, null);
  assert.deepEqual([zwei.stand.ist, zwei.stand.soll], [Z.gaeste[0], Z.gaeste[1]]);
  const d = E.dinge(state);
  assert.deepEqual(d.schilder, [2]);
  assert.ok(d.wimpel.includes(E.GRUPPEN.gaeste.farbe));
  assert.deepEqual(d.pokale, []);
});
