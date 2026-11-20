// Tests für P20-Rest: Jahreszeiten spürbar (G5) und Dauerlieger nutzen den Hafen (H5). Aufruf: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { YEAR } from '../web/js/data/events.js';
import { createScheduler } from '../web/js/events/scheduler.js';
import { erstelleRegeln, neuerZustand } from '../web/js/services/rules.js';
import { echterHafen } from './regeln.mjs';
import * as sim from '../web/js/sim.js';

const ctx = echterHafen();
const Z = ECONOMY.zeit;
const tagIn = (part) => Z.jahreszeiten[part][0];

test('G5: jede Jahreszeit der Saison hat eine Wirkung, im Mittel etwa 1', () => {
  const W = Z.jahreszeitWirkung;
  let summe = 0, tage = 0;
  for (const [part, [von, bis]] of Object.entries(Z.jahreszeiten)) {
    assert.ok(W[part], `keine Wirkung für ${part}`);
    summe += W[part].arrivalFactor * (bis - von + 1);
    tage += bis - von + 1;
  }
  assert.equal(tage, Z.saisonTage, 'Jahreszeiten decken die Saison ab');
  const mittel = summe / tage;
  assert.ok(mittel > 0.95 && mittel < 1.1, `Mittel ${mittel}`);
  assert.ok(W.fruehling.arrivalFactor < 1 && W.herbst.arrivalFactor < 1 && W.sommer.arrivalFactor > 1);
});

test('G5: Ankünfte folgen der Jahreszeit (Frühling ruhig, Sommer voll, Herbst Segler)', () => {
  const st = createState();
  st.stage = 4;
  const rate = (part) => { st.day = tagIn(part); return sim.arrivalRate(st, ctx); };
  assert.equal(sim.seasonPart({ day: 1 }, ctx), 'fruehling');
  assert.equal(sim.seasonPart({ day: tagIn('sommer') }, ctx), 'sommer');
  assert.equal(sim.seasonPart({ day: Z.saisonTage }, ctx), 'herbst');
  assert.equal(sim.seasonPart({ day: Z.saisonTage + 1 }, ctx), 'winter');
  assert.ok(rate('fruehling') < rate('sommer'), 'Sommer voller als Frühling');
  assert.ok(rate('herbst') < rate('sommer'), 'Sommer voller als Herbst');
  st.day = tagIn('herbst');
  const m = sim.modifiers(st, ctx);
  assert.ok(m.kindFactor.segelyacht > 1, 'Herbst: mehr Fahrtensegler');
  assert.ok(m.kindFactor.jolle < 1, 'Herbst: weniger Jollen');
  st.day = tagIn('sommer');
  assert.ok(sim.modifiers(st, ctx).sizeFactor.S > 1, 'Sommer: mehr kleine Boote');
});

test('G5: Herbst ist windiger als Sommer (Alltagswetter)', () => {
  assert.ok(YEAR.wind.herbst > YEAR.wind.sommer);
  const sch = createScheduler({ seed: 7 });
  const mittel = (part) => {
    const [von, bis] = Z.jahreszeiten[part];
    let s = 0, n = 0;
    for (let j = 0; j < 5; j++) for (let d = von; d <= bis; d++) { s += sch.weather(j * (Z.saisonTage + Z.winterTage) + d).wind; n++; }
    return s / n;
  };
  assert.ok(mittel('herbst') > mittel('sommer') + 0.15, `Herbst ${mittel('herbst')} Sommer ${mittel('sommer')}`);
});

const R = erstelleRegeln();
const S6 = { stufe: 6, ruf: 5 };
const dauer = (n, extra = {}) => Array.from({ length: n }, () => ({ klasse: 'M', antrieb: 'segel', imHafen: true, winterlager: false, kuendigung: null, ...extra }));

test('H5: Krantage am ersten und letzten Saisontag bringen Mastenkran und Travellift Geld', () => {
  const z = neuerZustand();
  R.bauen(z, 'mastenkran', S6);
  R.bauen(z, 'travellift', S6);
  const tag = (saisonTag, liste) => R.tagesabschluss(z, { tag: saisonTag, saisonTag, saisonTage: Z.saisonTage, boote: [], dauerlieger: liste }, () => 0.99);
  const normal = tag(5, dauer(6));
  assert.equal(normal.krantag, undefined, 'kein Krantag mitten in der Saison');
  const fr = tag(1, [...dauer(6), ...dauer(2, { antrieb: 'motor' })]);
  assert.equal(fr.krantag.art, 'fruehling');
  assert.equal(fr.krantag.boote, 8, 'alle acht kommen per Travellift ins Wasser');
  assert.equal(fr.mengen.mastenkran.dauerlieger, 6, 'nur Segler stellen den Mast');
  const kranGeld = 6 * ECONOMY.services.mastenkran.stufen[0].wirkung.dauerlieger.preis;
  assert.ok(fr.krantag.betrag >= kranGeld + 8 * 60 - 1, `Krantag ${fr.krantag.betrag}`);
  // Bilanz: der Krantag zählt anteilig (zweimal je Saison), nicht als Tagesschnitt
  const bil = R.bilanz(z, 'mastenkran');
  assert.equal(bil.proTag, Math.round((2 * kranGeld) / Z.saisonTage), `Schnitt ${bil.proTag}`);
  const he = tag(Z.saisonTage, [...dauer(3), ...dauer(1, { kuendigung: 'spieler' })]);
  assert.equal(he.krantag.art, 'herbst');
  assert.equal(he.krantag.boote, 3, 'wer gekündigt hat, geht nicht ins Winterlager');
});

test('H5: Segelmacher verdient an segelnden Dauerliegern, Winterlager an ihren Booten im Winter', () => {
  const z = neuerZustand();
  R.bauen(z, 'segelclub', S6);
  assert.ok(R.bauen(z, 'segelmacher', S6).ok !== false);
  const mit = R.tagesabschluss(z, { tag: 5, saisonTag: 5, boote: [], dauerlieger: dauer(20) }, () => 0.5);
  const ohne = R.tagesabschluss(z, { tag: 6, saisonTag: 6, boote: [], dauerlieger: [] }, () => 0.5);
  assert.ok(mit.summe > ohne.summe, `Segelmacher mit ${mit.summe} ohne ${ohne.summe}`);
  assert.ok(mit.mengen.segelmacher.dauerlieger >= 1);
  const motor = R.tagesabschluss(z, { tag: 7, saisonTag: 7, boote: [], dauerlieger: dauer(20, { antrieb: 'motor' }) }, () => 0.5);
  assert.equal(motor.summe, ohne.summe, 'Motorboote brauchen keine Segel');

  const w = neuerZustand();
  R.bauen(w, 'mastenkran', S6);
  R.bauen(w, 'travellift', S6);
  R.bauen(w, 'travellift', S6);
  R.bauen(w, 'winterlager', S6);
  const winter = (liste) => R.tagesabschluss(w, { tag: 17, winter: true, boote: [], dauerlieger: liste }, () => 0.5).summe;
  const leer = winter([]);
  const voll = winter(dauer(5, { imHafen: false, winterlager: true }));
  assert.equal(voll - leer, 5 * ECONOMY.services.winterlager.stufen[0].wirkung.dauerlieger.winter);
});
