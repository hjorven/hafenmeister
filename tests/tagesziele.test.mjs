// Tagesziele (docs/neue-features.md, Abschnitt 6): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import {
  neueKarten, waehle, gewaehlt, werteAus, zielState, text, VORLAGEN, WOCHE, DEKO, lage, tageswechsel,
  gibBelohnung, loeseGutschein, seltenerGastHook, selteneArten, belohnungText, neueWoche,
} from '../web/js/features/tagesziele.js';

function neu(seed = 3, stufe = 1) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = createState({ seed, rules: ctx.rules });
  state.stage = stufe;
  // Alle Plätze und Versorgung der Stufe, damit alle Vorlagen möglich sind
  for (const b of ctx.berths) if ((b.stage ?? 1) <= stufe && b.requires) state.buildings[b.requires] = 1;
  sim.tick(state, ctx, 0);
  return { ctx, state };
}

function eigenesZiel(state, ziel) {
  const z = zielState(state);
  z.tag = state.day;
  z.karten = [{ ist: 0, erledigt: false, schwere: 'leicht', belohnung: { art: 'geld', wert: 10 }, ...ziel }];
  z.gewaehlt = 0;
  return z.karten[0];
}

test('morgens drei Karten: leicht, mittel, schwer, verschiedene Arten, passend zur Stufe', () => {
  for (const stufe of [1, 2, 3, 4, 5]) {
    for (let seed = 1; seed < 12; seed++) {
      const { ctx, state } = neu(seed, stufe);
      const k = neueKarten(state, ctx);
      assert.deepEqual(k.map((x) => x.schwere), ['leicht', 'mittel', 'schwer'], `Stufe ${stufe}`);
      assert.equal(new Set(k.map((x) => x.art)).size, 3, `Stufe ${stufe}, Seed ${seed}: ${k.map((x) => x.art)}`);
      for (const z of k) {
        assert.ok((VORLAGEN[z.art].abStufe ?? 1) <= stufe, `${z.art} in Stufe ${stufe}`);
        assert.ok(z.soll >= 1);
        assert.equal(typeof text(z), 'string');
        assert.ok(belohnungText(z.belohnung).length > 0);
      }
      assert.equal(k[0].belohnung.art, 'geld');
      assert.ok(!k.some((z) => z.art === 'stammgast'), 'Stammgast-Ziel nur mit Stammgästen');
      assert.equal(gewaehlt(state), null);
    }
  }
});

test('nur eine Karte wählbar, vorher zählt nichts', () => {
  const { ctx, state } = neu();
  neueKarten(state, ctx);
  const z = zielState(state);
  z.karten[0] = { art: 'einweisen', schwere: 'leicht', soll: 1, ist: 0, erledigt: false, belohnung: { art: 'geld', wert: 10 } };
  state.boats[1] = { id: 1, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  assert.equal(werteAus(state, ctx, { type: 'moored', boatId: 1, hand: true }).tag, null);
  assert.equal(waehle(state, 0), true);
  assert.equal(waehle(state, 1), false);
  assert.equal(werteAus(state, ctx, { type: 'moored', boatId: 1, hand: true }).tag, z.karten[0]);
});

test('nur eigene Handlungen zählen: selbst eingefahren, Automat und Rundgang nicht', () => {
  const { ctx, state } = neu();
  const ziel = eigenesZiel(state, { art: 'einweisen', soll: 2 });
  state.boats[1] = { id: 1, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  werteAus(state, ctx, { type: 'moored', boatId: 1 });              // selbst eingefahren
  werteAus(state, ctx, { type: 'selfEntered', boatId: 1 });
  assert.equal(ziel.ist, 0);
  werteAus(state, ctx, { type: 'moored', boatId: 1, hand: true });
  assert.equal(ziel.ist, 1);

  const { state: s2, ctx: c2 } = neu();
  const k = eigenesZiel(s2, { art: 'kassieren', soll: 20 });
  werteAus(s2, c2, { type: 'collected', boatId: 1, amount: 15 });              // Automat
  werteAus(s2, c2, { type: 'collected', boatId: 1, amount: 15, round: true }); // Rundgang
  assert.equal(k.ist, 0);
  werteAus(s2, c2, { type: 'collected', boatId: 1, amount: 15, hand: true });
  assert.equal(k.ist, 15);
  assert.ok(werteAus(s2, c2, { type: 'collected', boatId: 2, amount: 15, hand: true }).tag);
  assert.equal(k.ist, 20);
});

test('sim.js: Zuweisen von Hand trägt hand, Einfahren lassen und Selbst-Einfahren nicht', () => {
  const { ctx, state } = neu(5, 2);
  sim.tick(state, ctx, ctx.rules.dayLength * 0.9);
  const wartend = sim.waitingBoats(state);
  const alle = [];
  for (const b of wartend) {
    const platz = sim.fittingBerths(state, ctx, b.id)[0];
    if (!platz) continue;
    alle.push(...sim.assign(state, ctx, b.id, platz).events);
    break;
  }
  const m = alle.find((e) => e.type === 'moored');
  if (m) assert.equal(m.hand, true);
  const zweites = sim.waitingBoats(state)[0];
  if (zweites) {
    const ev = sim.autoEnter(state, ctx, zweites.id).events.find((e) => e.type === 'moored');
    if (ev) assert.equal(ev.hand, undefined);
  }
  // Einzelne Münze: nur mit { hand: true } ein Handgriff des Spielers
  const boot = sim.mooredBoats(state).find((b) => b.pendingFee > 0);
  if (boot) {
    const c = sim.collect(state, ctx, boot.id, { hand: true }).events[0];
    assert.equal(c.hand, true);
  }
});

test('Wunsch versorgen zählt nur frisch von Hand eingewiesene Boote, Segler-Variante prüft die Art', () => {
  const { ctx, state } = neu(3, 2);
  const ziel = eigenesZiel(state, { art: 'wunsch', soll: 2, extra: { wunsch: 'dusche', segler: false } });
  state.boats[1] = { id: 1, typeId: 'M1', size: 'M', stationed: false, wishes: ['dusche'] };
  state.boats[2] = { id: 2, typeId: 'M1', size: 'M', stationed: false, wishes: ['dusche'] };
  // Boot 1 nicht von Hand: Münze zählt nicht
  werteAus(state, ctx, { type: 'moored', boatId: 1 });
  werteAus(state, ctx, { type: 'feeReady', boatId: 1, wishesMet: ['dusche'] });
  assert.equal(ziel.ist, 0);
  werteAus(state, ctx, { type: 'moored', boatId: 2, hand: true });
  werteAus(state, ctx, { type: 'feeReady', boatId: 2, wishesMet: ['dusche'] });
  assert.equal(ziel.ist, 1);
  // Am nächsten Morgen zahlt Boot 2 wieder: zählt nicht noch einmal
  werteAus(state, ctx, { type: 'feeReady', boatId: 2, wishesMet: ['dusche'] });
  assert.equal(ziel.ist, 1);
});

test('kombiniertes Ziel: Segelboote an Plätze mit Strom', () => {
  const { ctx, state } = neu(3, 3);
  const ziel = eigenesZiel(state, { art: 'seglerStrom', soll: 1 });
  const segler = ctx.types.find((t) => t.sail && t.size !== 'S');
  const mitStrom = sim.availableBerths(state, ctx).find((b) => sim.berthHas(state, ctx, b, 'power'));
  const ohneStrom = sim.availableBerths(state, ctx).find((b) => !sim.berthHas(state, ctx, b, 'power'));
  assert.ok(segler && mitStrom && ohneStrom);
  state.boats[1] = { id: 1, typeId: segler.id, size: segler.size, stationed: false, wishes: [] };
  werteAus(state, ctx, { type: 'moored', boatId: 1, berthId: ohneStrom.id, hand: true });
  assert.equal(ziel.ist, 0);
  assert.ok(werteAus(state, ctx, { type: 'moored', boatId: 1, berthId: mitStrom.id, hand: true }).tag);
});

test('Ziele, die nicht machbar sind, kommen nicht: volle Automatik ohne Zuweis- und Kassierziele', () => {
  const { ctx, state } = neu(3, 4);
  state.office = 99;
  const h = lage(state, ctx);
  assert.equal(h.zuweisen, false);
  assert.equal(h.kassieren, false);
  assert.deepEqual(neueKarten(state, ctx), []);
  assert.equal(neueWoche(state, ctx), null);
});

test('im Winter keine Karten, das Wochenziel ruht und zählt keine Tage', () => {
  const { ctx, state } = neu();
  tageswechsel(state, ctx);
  const z = zielState(state);
  assert.ok(z.woche);
  const tage = z.woche.tage;
  state.day = ctx.rules.seasonDays + 1; // erster Wintertag, der Saisontag davor zählt
  z.tag = ctx.rules.seasonDays;
  tageswechsel(state, ctx);
  assert.deepEqual(z.karten, []);
  const nachSaison = z.woche?.tage;
  state.day += 1;
  tageswechsel(state, ctx);
  assert.equal(z.woche?.tage, nachSaison, 'Wintertag zählt nicht');
  assert.ok(tage >= 1);
});

test('Wochenziel läuft sieben Saisontage und zählt zufriedene, von Hand eingewiesene Gäste', () => {
  const { ctx, state } = neu();
  const z = zielState(state);
  tageswechsel(state, ctx);
  z.woche = { art: 'zufrieden', soll: 2, ist: 0, erledigt: false, tage: 7, geld: 120, deko: 'kuebel' };
  state.boats[1] = { id: 1, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  state.boats[2] = { id: 2, typeId: 'S1', size: 'S', stationed: false, wishes: [] };
  werteAus(state, ctx, { type: 'moored', boatId: 1, hand: true });
  werteAus(state, ctx, { type: 'moored', boatId: 2 });
  werteAus(state, ctx, { type: 'departed', boatId: 2, rating: 5, typeId: 'S1' });
  assert.equal(z.woche.ist, 0, 'selbst eingefahren zählt nicht');
  werteAus(state, ctx, { type: 'departed', boatId: 1, rating: 3.5, typeId: 'S1' });
  assert.equal(z.woche.ist, 0, 'unter 4 Ankern zählt nicht');
  assert.equal(z.hand[1], undefined, 'Abgereiste fallen aus der Liste');
  for (let tag = 0; tag < 7; tag++) { state.day += 1; tageswechsel(state, ctx); }
  assert.notEqual(z.woche?.art === 'zufrieden' && z.woche.soll === 2, true, 'nach sieben Tagen ein neues Wochenziel');
  assert.ok(Object.keys(WOCHE).length >= 3);
});

test('Belohnungen: halber Anker, Gutschein, Deko, seltener Gast', () => {
  const { ctx, state } = neu(4, 3);
  sim.tick(state, ctx, ctx.rules.dayLength * 0.9);
  for (const b of sim.waitingBoats(state)) {
    const p = sim.fittingBerths(state, ctx, b.id)[0];
    if (p) sim.assign(state, ctx, b.id, p);
  }
  const liegt = sim.mooredBoats(state).filter((b) => !b.stationed);
  assert.ok(liegt.length > 0);
  const vorher = liegt.map((b) => sim.rateBoat(ctx, b));
  gibBelohnung(state, ctx, { art: 'anker', wert: 0.5 });
  liegt.forEach((b, i) => assert.ok(sim.rateBoat(ctx, b) >= Math.min(5, vorher[i] + 0.4)));

  gibBelohnung(state, ctx, { art: 'gutschein', prozent: 10, hoechstens: 300 });
  assert.equal(loeseGutschein(state, 1000), 100);
  assert.equal(loeseGutschein(state, 1000), 0, 'nur einmal');
  gibBelohnung(state, ctx, { art: 'gutschein', prozent: 10, hoechstens: 300 });
  assert.equal(loeseGutschein(state, 9000), 300, 'gedeckelt');

  gibBelohnung(state, ctx, { art: 'deko', id: DEKO[0].id });
  assert.deepEqual(zielState(state).deko, [DEKO[0].id]);

  const selten = selteneArten(state, ctx);
  assert.ok(selten.length > 0);
  gibBelohnung(state, ctx, { art: 'gast', typeId: selten[0].id, name: selten[0].name });
  // Heute noch nicht, morgen schon
  const heute = sim.rollBoat(state, ctx);
  seltenerGastHook({ state, ctx, boat: heute });
  assert.ok(!heute.selten);
  state.day += 1;
  const morgen = sim.rollBoat(state, ctx);
  seltenerGastHook({ state, ctx, boat: morgen });
  assert.equal(morgen.selten, true);
  assert.ok(selten.some((t) => t.id === morgen.typeId));
  assert.ok(sim.couldEverFit(state, ctx, morgen));
  assert.equal(zielState(state).gast, null);
});

test('alte Spielstände mit drei festen Zielen laufen weiter', () => {
  const { ctx, state } = neu();
  state.modules.ziele = { tag: state.day, liste: [{ art: 'unterbringen', soll: 2, ist: 0 }] };
  const z = zielState(state);
  assert.equal(z.version, 2);
  assert.ok(tageswechsel(state, ctx));
  assert.equal(z.karten.length, 3);
});
