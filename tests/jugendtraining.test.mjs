// Jugendtraining am Segelclub (P39, docs/jugendtraining.md): Regeln ohne Browser, mit den echten Zahlen.
// Aufruf: node --test tests/jugendtraining.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as jt from '../web/js/features/jugendtraining.js';

const JT = ECONOMY.jugendtraining;

function neu({ seed = 7, stufe = 3, club = 1, slip = 1, ansicht = false, wetter = null } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  jt.haengeEin((n, f) => sim.addHook(ctx, n, f), { ansicht: () => ansicht, wetter: () => wetter });
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  state.modules.services = { gebaut: { ...(club ? { segelclub: club } : {}), ...(slip ? { slip } : {}) }, besuche: {}, summe: {} };
  return { ctx, state };
}

/** Bis zum Morgen des nächsten Trainingstags vorspielen (erster Takt des Tages gelaufen). */
function bisTraining(state, ctx, maxTage = 40) {
  for (let i = 0; i < maxTage; i++) {
    sim.tick(state, ctx, 1);
    const h = state.modules.jugend?.heute;
    if (h && h.tag === state.day) return h;
    sim.runDay(state, ctx);
  }
  return null;
}
function tickBis(state, ctx, clock) {
  const ev = [];
  while (state.clock < clock && state.phase === 'day') ev.push(...sim.tick(state, ctx, 1));
  return ev;
}
const jugendEv = (ev) => ev.filter((e) => e.type === 'jugend');

test('Zahlen stehen in economy.js und passen zusammen', () => {
  assert.ok(JT.alle >= 2 && JT.ersterTag >= 1 && JT.ersterTag <= ECONOMY.zeit.saisonTage);
  assert.ok(JT.beginn > 0 && JT.beginn + JT.dauer < 1, 'ohne Bild zurück vor dem Abend');
  assert.ok(JT.beginn + JT.notfall <= 1);
  assert.ok(JT.ruf > 0 && JT.ruf <= 0.5);
  assert.equal(JT.gruppe.length, ECONOMY.services.segelclub.stufen.length, 'eine Gruppe je Ausbau des Segelclubs');
  for (const g of JT.gruppe) assert.ok(g.optis >= 1 && g.beitrag > 0 && g.eltern >= 0);
  JT.gruppe.forEach((g, i) => assert.equal(ECONOMY.services.segelclub.stufen[i].wirkung.jugend, g.optis + g.jollen, 'Bauen-Menü nennt die Bootszahl der Gruppe'));
  assert.ok(sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN }).rules.youth.rating === JT.ruf);
});

test('Feste Trainingstage: jeden 4. Saisontag ab dem 3., nie im Winter', () => {
  const { ctx, state } = neu();
  const tage = [];
  for (let d = 1; d <= ECONOMY.zeit.saisonTage + ECONOMY.zeit.winterTage; d++) {
    const s = sim.season({ day: d }, ctx);
    if (!s.winter && jt.istTrainingstag(s.day)) tage.push(s.day);
  }
  assert.deepEqual(tage.slice(0, 4), [JT.ersterTag, JT.ersterTag + JT.alle, JT.ersterTag + 2 * JT.alle, JT.ersterTag + 3 * JT.alle]);
  assert.equal(jt.naechsterTag(state, ctx, 1), JT.ersterTag);
  // Im Winter: der erste Trainingstag der nächsten Saison
  const len = ECONOMY.zeit.saisonTage + ECONOMY.zeit.winterTage;
  assert.equal(jt.naechsterTag(state, ctx, ECONOMY.zeit.saisonTage + 1), len + JT.ersterTag);
});

test('Ohne Segelclub oder ohne Slip gibt es kein Training', () => {
  for (const [club, slip] of [[0, 1], [1, 0], [0, 0]]) {
    const { ctx, state } = neu({ club, slip });
    assert.equal(bisTraining(state, ctx, 20), null, `club ${club} slip ${slip}`);
  }
});

test('Ohne Box fällt das Training aus, kostet nichts, keine Box blockiert', () => {
  const { ctx, state } = neu({ seed: 3 });
  const h = bisTraining(state, ctx);
  assert.ok(h);
  assert.equal(h.phase, 'angekuendigt');
  assert.equal(state.day, JT.ersterTag);
  const geld = state.money;
  const ev = tickBis(state, ctx, JT.beginn * ctx.rules.dayLength + 2);
  assert.equal(h.phase, 'ausgefallen');
  assert.equal(h.grund, 'keineBox');
  assert.ok(jugendEv(ev).some((e) => e.phase === 'ausgefallen' && e.grund === 'keineBox'));
  assert.ok(state.money >= geld, 'kein Abzug');
  assert.equal(state.modules.jugend.ausgefallen, 1);
});

test('Box geben: frei gehalten, Gruppe läuft aus und kommt zurück, Beitrag und Anker', () => {
  const { ctx, state } = neu({ seed: 4, club: 2 });
  const h = bisTraining(state, ctx);
  const frei = jt.plaetze(state, ctx);
  assert.ok(frei.length > 0);
  const platz = frei[0];
  const r = jt.zuweisen(state, ctx, platz);
  assert.ok(r.ok);
  assert.equal(h.phase, 'bereit');
  // Die Box ist für andere Boote gesperrt (Hook fit), für das Trainerboot nicht
  const berth = ctx.berthById[platz];
  assert.equal(jt.passHook({ state, boat: { id: 99 }, berth }), 'jugendtraining');
  assert.equal(jt.passHook({ state, boat: jt.trainerBoot(), berth }), null);
  assert.ok(!sim.availableBerths(state, ctx).filter((p) => sim.isFree(state, p.id) && !sim.hookWhyNotFit(state, ctx, { id: 5, size: 'S', length: 4, beam: 1.8, draft: 0.5 }, p)).some((p) => p.id === platz));
  // Bis zum Abend spielen: niemand liegt in der Box
  const L = ctx.rules.dayLength;
  let ev = tickBis(state, ctx, JT.beginn * L + 1);
  assert.equal(h.phase, 'draussen');
  assert.ok(jugendEv(ev).some((e) => e.phase === 'draussen'));
  const geld = state.money;
  ev = tickBis(state, ctx, (JT.beginn + JT.dauer) * L + 1);
  assert.equal(h.phase, 'zurueck');
  const z = jugendEv(ev).find((e) => e.phase === 'zurueck');
  assert.ok(z);
  assert.equal(z.beitrag, JT.gruppe[1].beitrag);
  assert.equal(state.money - geld >= JT.gruppe[1].beitrag, true);
  assert.equal(sim.heute(state).details.services.segelclub, JT.gruppe[1].beitrag);
  // Gäste im Hafen haben zugesehen
  const gaeste = sim.mooredBoats(state).filter((b) => !b.stationed);
  assert.equal(z.zuschauer, gaeste.length);
  for (const b of gaeste) assert.equal(b.jugend, true);
  for (const b of gaeste) assert.ok(sim.ratingParts(ctx, b).jugend === JT.ruf);
  assert.ok(!state.berths[platz], 'Box blieb frei');
  // Bis zum Morgen: die Box ist wieder für alle
  sim.runDay(state, ctx);
  sim.tick(state, ctx, 1);
  assert.equal(jt.passHook({ state, boat: { id: 99 }, berth }), null);
  assert.equal(state.modules.jugend.trainings, 1);
});

test('Wer später ankommt oder schon zugesehen hat, zählt nicht doppelt', () => {
  const { ctx, state } = neu({ seed: 9 });
  bisTraining(state, ctx);
  jt.zuweisen(state, ctx, jt.plaetze(state, ctx)[0]);
  tickBis(state, ctx, (JT.beginn + JT.dauer) * ctx.rules.dayLength + 1);
  const erste = sim.mooredBoats(state).filter((b) => b.jugend).map((b) => b.id);
  // Am Abend kein zweites Zurück
  const ev = [];
  while (state.phase === 'day') ev.push(...sim.tick(state, ctx, 1));
  assert.equal(jugendEv(ev).filter((e) => e.phase === 'zurueck').length, 0);
  assert.deepEqual(sim.mooredBoats(state).filter((b) => b.jugend).map((b) => b.id).filter((id) => !erste.includes(id)), []);
});

test('Feste Trainerbox: das Trainerboot liegt am nächsten Trainingstag von selbst dort, wenn sie frei ist', () => {
  const { ctx, state } = neu({ seed: 5 });
  bisTraining(state, ctx);
  const platz = jt.plaetze(state, ctx)[0];
  jt.zuweisen(state, ctx, platz, { merken: true });
  assert.equal(state.modules.jugend.stammbox, platz);
  sim.runDay(state, ctx);
  // Nächster Trainingstag
  const h = bisTraining(state, ctx);
  assert.equal(state.day, JT.ersterTag + JT.alle);
  if (sim.isFree(state, platz)) {
    assert.equal(h.phase, 'bereit');
    assert.equal(h.platz, platz);
    assert.equal(h.auto, true);
  } else assert.equal(h.phase, 'angekuendigt');
  // Belegte feste Box: Frage statt automatisch
  sim.runDay(state, ctx);
  const st2 = neu({ seed: 5 });
  bisTraining(st2.state, st2.ctx);
  const p2 = jt.plaetze(st2.state, st2.ctx)[0];
  jt.stammboxSetzen(st2.state, p2);
  sim.runDay(st2.state, st2.ctx);
  // Box belegen, bevor der nächste Trainingstag geplant wird
  for (let i = 0; i < 6; i++) {
    sim.tick(st2.state, st2.ctx, 0);
    if (sim.season(st2.state, st2.ctx).day === JT.ersterTag + JT.alle) break;
    sim.runDay(st2.state, st2.ctx);
  }
  st2.state.berths[p2] = 424242;
  st2.state.boats[424242] = { id: 424242, status: 'moored', berthId: p2, size: 'S', length: 4, beam: 1.8, draft: 0.4, nights: 2, wishes: [] };
  sim.tick(st2.state, st2.ctx, 1);
  const h2 = st2.state.modules.jugend.heute;
  assert.equal(h2.phase, 'angekuendigt');
  assert.ok(!jt.plaetze(st2.state, st2.ctx).includes(p2));
});

test('Absagen und Wetter: Sturm, Starkwind und Regatta fallen aus, Absagen kostet nichts', () => {
  for (const [wetter, grund] of [[{ sturm: true }, 'sturm'], [{ stark: true }, 'wind'], [{ regatta: true }, 'regatta']]) {
    const { ctx, state } = neu({ wetter });
    const h = bisTraining(state, ctx);
    assert.equal(h.phase, 'ausgefallen', grund);
    assert.equal(h.grund, grund);
    assert.deepEqual(jt.plaetze(state, ctx).length > 0, true);
    assert.equal(jt.zuweisen(state, ctx, jt.plaetze(state, ctx)[0]).ok, false);
  }
  const { ctx, state } = neu();
  bisTraining(state, ctx);
  const platz = jt.plaetze(state, ctx)[0];
  jt.zuweisen(state, ctx, platz);
  const geld = state.money;
  const r = jt.absagen(state);
  assert.ok(r.ok);
  assert.equal(state.modules.jugend.heute.phase, 'ausgefallen');
  assert.equal(jt.passHook({ state, boat: { id: 1 }, berth: ctx.berthById[platz] }), null, 'Box wieder frei');
  assert.equal(state.money, geld);
  assert.equal(jt.absagen(state).ok, false, 'nicht zweimal');
});

test('Mit Bild: die Regeln warten auf das Bild, greifen aber als Notbremse', () => {
  const { ctx, state } = neu({ ansicht: true, seed: 8 });
  const h = bisTraining(state, ctx);
  jt.zuweisen(state, ctx, jt.plaetze(state, ctx)[0]);
  const L = ctx.rules.dayLength;
  tickBis(state, ctx, JT.beginn * L + 5);
  assert.equal(h.phase, 'bereit', 'das Bild meldet das Auslaufen');
  assert.ok(jt.auslaufen(state).ok);
  assert.equal(jt.auslaufen(state).ok, false);
  tickBis(state, ctx, (JT.beginn + JT.dauer) * L + 5);
  assert.equal(h.phase, 'draussen', 'ohne Meldung des Bilds noch draußen');
  tickBis(state, ctx, (JT.beginn + JT.notfall) * L + 2);
  assert.equal(h.phase === 'zurueck' || state.phase !== 'day', true);
  // Bild meldet sich nicht mal zum Auslaufen: Notbremse nach 0,12 Tag
  const b = neu({ ansicht: true, seed: 8 });
  const h2 = bisTraining(b.state, b.ctx);
  jt.zuweisen(b.state, b.ctx, jt.plaetze(b.state, b.ctx)[0]);
  tickBis(b.state, b.ctx, (JT.beginn + 0.13) * L);
  assert.equal(h2.phase, 'draussen');
});

test('Gruppe nach Ausbau des Segelclubs', () => {
  for (let n = 1; n <= JT.gruppe.length; n++) {
    const { state } = neu({ club: n });
    assert.deepEqual(jt.gruppeFuer(state), JT.gruppe[n - 1]);
  }
});

test('Stufenausbau nimmt die Box weg: neue Frage, feste Box vergessen', () => {
  const { ctx, state } = neu();
  bisTraining(state, ctx);
  const platz = jt.plaetze(state, ctx)[0];
  jt.zuweisen(state, ctx, platz, { merken: true });
  const events = [];
  jt.stufeHook({ state, gone: [platz], events });
  assert.equal(state.modules.jugend.heute.phase, 'angekuendigt');
  assert.equal(state.modules.jugend.heute.platz, null);
  assert.equal(state.modules.jugend.stammbox, null);
  assert.ok(events.some((e) => e.type === 'jugend' && e.vorher === platz));
});

test('Spielstand: Speichern und Laden mitten im Training', () => {
  const { ctx, state } = neu({ seed: 6 });
  bisTraining(state, ctx);
  const platz = jt.plaetze(state, ctx)[0];
  jt.zuweisen(state, ctx, platz, { merken: true });
  tickBis(state, ctx, JT.beginn * ctx.rules.dayLength + 2);
  const geladen = deserialize(serialize(state));
  assert.equal(geladen.modules.jugend.heute.phase, 'draussen');
  assert.equal(geladen.modules.jugend.stammbox, platz);
  assert.equal(jt.passHook({ state: geladen, boat: { id: 3 }, berth: ctx.berthById[platz] }), 'jugendtraining');
});

test('Kein Spielzufall: gleiche Gäste mit und ohne Jugendtraining', () => {
  const a = neu({ seed: 12 });
  const ctx2 = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  const b = { ctx: ctx2, state: createState({ seed: 12 }) };
  b.state.stage = 3;
  for (const x of ctx2.berths) if (x.requires) b.state.buildings[x.requires] = 1;
  b.state.modules.services = structuredClone(a.state.modules.services);
  for (let i = 0; i < 6; i++) { sim.runDay(a.state, a.ctx); sim.runDay(b.state, b.ctx); }
  assert.equal(a.state.guests, b.state.guests);
  assert.equal(a.state.rng, b.state.rng);
});

test('Hundert Saisontage mit Spieler, der immer die erste Box gibt: kein Fehler, Zahlen stimmen', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { ctx, state } = neu({ seed, club: 1 + (seed % 3), stufe: 3 + (seed % 3) });
    let gegeben = 0;
    for (let i = 0; i < 100; i++) {
      sim.tick(state, ctx, 1);
      const h = state.modules.jugend?.heute;
      if (h && h.tag === state.day && h.phase === 'angekuendigt') {
        const p = jt.plaetze(state, ctx)[0];
        if (p && jt.zuweisen(state, ctx, p).ok) gegeben++;
      }
      // tagsüber nie ein Gast in der Trainerbox
      while (state.phase === 'day') {
        sim.tick(state, ctx, 5);
        const hh = state.modules.jugend?.heute;
        if (hh?.tag === state.day && hh.platz && ['bereit', 'draussen', 'zurueck'].includes(hh.phase)) {
          assert.ok(!state.berths[hh.platz], `Seed ${seed} Tag ${state.day}: Gast in der Trainerbox ${hh.platz}`);
        }
      }
      sim.runDay(state, ctx);
    }
    const s = state.modules.jugend;
    assert.ok(s.trainings >= 1, `Seed ${seed}: ${s.trainings} Trainings`);
    assert.ok(s.trainings <= gegeben);
    assert.equal(s.trainings + s.ausgefallen <= 100, true);
  }
});
