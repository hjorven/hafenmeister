// Spätankömmling (P53, docs/spaetankoemmling.md): Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { meldungText } from '../web/js/features/spaetankoemmling-text.js';
import { gruendeAusAbreise, satz } from '../web/js/ui/gaestebuch-daten.js';

function neu({ seed = 11, stufe = 3, ansicht = false } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  if (ansicht) ctx.ansichtMeldetFest = () => true;
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  return { ctx, state };
}

// Bis zum Morgen eines Tages mit Spätankömmling spielen; gibt das Boot zurück (noch erwartet)
function bisSpaet(state, ctx, maxTage = 40) {
  for (let i = 0; i < maxTage; i++) {
    sim.tick(state, ctx, 0);
    const b = state.upcoming.find((x) => x.spaet === state.day);
    if (b) {
      // Platz schaffen: ohne Spieler ist der Hafen sonst abends oft voll (voller Hafen hat einen eigenen Test)
      for (const m of sim.mooredBoats(state).filter((x) => !x.stationed)) { delete state.berths[m.berthId]; delete state.boats[m.id]; }
      return b;
    }
    sim.runDay(state, ctx);
  }
  return null;
}

function tickBis(state, ctx, bedingung, max = 2000) {
  const ev = [];
  for (let i = 0; i < max && !bedingung(); i++) ev.push(...sim.tick(state, ctx, 0.5));
  return ev;
}

test('Zahlen stehen in economy.js und passen zusammen', () => {
  const E = ECONOMY.spaetankoemmling;
  assert.ok(E.abTag >= 2 && E.anteil > 0 && E.anteil < 0.6);
  assert.ok(E.ankunft[0] > 0 && E.ankunft[1] >= E.ankunft[0] && E.ankunft[1] < ECONOMY.zeit.abendSekunden / 2);
  assert.ok(E.rest > 0 && E.rest < ECONOMY.zeit.abendSekunden * 0.15 + 0.01, 'Halt im Dunkeln (letzte 15 % des Abends)');
  assert.ok(E.haltMax > 0 && E.anker > 0 && E.anker <= 0.5);
  for (const a of E.arten) assert.ok(BOAT_CATALOG.some((t) => t.kind === a), a);
});

test('nur manche Abende, nie vor abTag, nie im Winter, nie in Stufe 1', () => {
  const { ctx, state } = neu();
  let tage = 0, spaet = 0;
  for (let i = 0; i < 36; i++) {
    sim.tick(state, ctx, 0);
    const sea = sim.season(state, ctx);
    const b = state.upcoming.find((x) => x.spaet === state.day);
    if (b) {
      spaet++;
      assert.ok(state.day >= ctx.rules.lateArrival.fromDay);
      assert.ok(!sea.winter);
      assert.ok(ctx.rules.lateArrival.kinds.includes(b.kind), b.kind);
      assert.ok(b.nights > 0 && !b.flotte && !b.stationed);
      assert.ok(b.arriveAt > ctx.rules.dayLength && b.arriveAt < ctx.rules.dayLength + ctx.rules.eveningLength / 2);
      assert.equal(state.upcoming.at(-1), b, 'kommt als Letzter');
    }
    if (!sea.winter) tage++;
    sim.runDay(state, ctx);
  }
  assert.ok(spaet >= 3 && spaet <= tage * 0.6, `${spaet} von ${tage}`);
  const s1 = neu({ stufe: 1 });
  for (let i = 0; i < 20; i++) {
    sim.tick(s1.state, s1.ctx, 0);
    assert.ok(!s1.state.upcoming.some((x) => x.spaet), 'Stufe 1: nur Ruder- und Tretboote');
    sim.runDay(s1.state, s1.ctx);
  }
});

test('kein Boot mehr als sonst: der Tag hat dieselben Boote', () => {
  const a = neu({ seed: 5 });
  const b = neu({ seed: 5 });
  b.ctx.rules.lateArrival = null;
  for (let i = 0; i < 20; i++) {
    sim.tick(a.state, a.ctx, 0);
    sim.tick(b.state, b.ctx, 0);
    assert.deepEqual(a.state.upcoming.map((x) => x.id).sort(), b.state.upcoming.map((x) => x.id).sort());
    sim.runDay(a.state, a.ctx);
    sim.runDay(b.state, b.ctx);
  }
});

test('läuft abends ein, die Nacht wartet, bis er in einer Box liegt', () => {
  const { ctx, state } = neu();
  const boot = bisSpaet(state, ctx);
  assert.ok(boot);
  const tag = state.day;
  tickBis(state, ctx, () => state.phase === 'evening');
  assert.ok(state.upcoming.includes(boot), 'bleibt am Abend erwartet');
  const ev = tickBis(state, ctx, () => state.boats[boot.id]?.status === 'moored' || state.day !== tag);
  assert.ok(ev.some((e) => e.type === 'lateArrival' && e.boatId === boot.id));
  assert.equal(state.day, tag, 'noch dieselbe Nacht');
  assert.ok(state.boats[boot.id].spaetDank);
  const m = ev.find((e) => e.type === 'moored' && e.boatId === boot.id);
  assert.ok(m?.spaet);
  // Ohne Ansicht gilt er gleich als fest: dann kommt der Morgen
  const rest = tickBis(state, ctx, () => state.day !== tag, 40);
  assert.ok(rest.some((e) => e.type === 'dayEnd'));
  assert.equal(state.nachtHalt, 0, 'morgens zurückgesetzt');
});

test('Halt höchstens haltMax, und nur solange er unterwegs ist', () => {
  const { ctx, state } = neu({ ansicht: true });
  const boot = bisSpaet(state, ctx);
  const tag = state.day;
  // Die Ansicht meldet nie "fest": die Nacht hält höchstens holdMax an
  tickBis(state, ctx, () => state.day !== tag, 4000);
  assert.ok(state.stats.verlauf.at(-1).tag === tag);
  const s2 = neu({ ansicht: true });
  const b2 = bisSpaet(s2.state, s2.ctx);
  tickBis(s2.state, s2.ctx, () => s2.state.boats[b2.id]?.status === 'moored');
  assert.equal(s2.state.boats[b2.id].spaetFest, false);
  const halt = s2.state.nachtHalt;
  sim.tick(s2.state, s2.ctx, 5);
  assert.ok(s2.state.nachtHalt <= s2.ctx.rules.lateArrival.holdMax + 1e-9);
  assert.ok(sim.lateDocked(s2.state, b2.id), 'Ansicht meldet fest');
  assert.equal(sim.lateArrivalPending(s2.state, s2.ctx), false);
  const vorher = s2.state.nachtHalt;
  sim.tick(s2.state, s2.ctx, 1);
  assert.ok(s2.state.nachtHalt === vorher || s2.state.nachtHalt === 0, 'kein weiterer Halt');
  assert.ok(halt >= 0 && boot);
});

test('voller Hafen: keine Box frei, dann wartet er über Nacht an der Boje (kein Halt)', () => {
  const { ctx, state } = neu();
  const boot = bisSpaet(state, ctx);
  const tag = state.day;
  tickBis(state, ctx, () => state.phase === 'evening');
  // alle passenden Boxen belegen
  for (const berth of ctx.berths) if (!state.berths[berth.id]) state.berths[berth.id] = -1;
  tickBis(state, ctx, () => state.boats[boot.id]?.atBuoy || state.day !== tag);
  assert.equal(sim.lateArrivalPending(state, ctx), false);
  const ev = tickBis(state, ctx, () => state.day !== tag, 60);
  assert.ok(ev.some((e) => e.type === 'dayEnd'));
  assert.ok(state.nachtHalt === 0);
  const b = state.boats[boot.id];
  assert.ok(b && b.status === 'waiting' && b.overnight === 1, 'liegt über Nacht an der Boje');
  assert.ok(!b.spaetDank);
});

test('Uhr für Tageslicht steht im Halt still, Tagesbericht und Morgen danach normal', () => {
  const { ctx, state } = neu();
  bisSpaet(state, ctx);
  const tag = state.day;
  let maxAnzeige = 0;
  for (let i = 0; i < 4000 && state.day === tag; i++) {
    sim.tick(state, ctx, 0.5);
    if (state.day === tag) {
      const u = sim.displayClock(state);
      assert.ok(u <= ctx.rules.dayLength + ctx.rules.eveningLength + 0.5);
      maxAnzeige = Math.max(maxAnzeige, u);
      assert.ok(state.clock <= sim.eveningEnd(state, ctx) + 1);
    }
  }
  assert.ok(maxAnzeige > ctx.rules.dayLength);
});

test('Speichern und Laden mitten im Halt', () => {
  const { ctx, state } = neu({ ansicht: true });
  const boot = bisSpaet(state, ctx);
  tickBis(state, ctx, () => state.boats[boot.id]?.status === 'moored');
  sim.tick(state, ctx, 3);
  assert.ok(state.nachtHalt > 0);
  const geladen = deserialize(serialize(state));
  assert.equal(geladen.nachtHalt, state.nachtHalt);
  sim.settleWaiting(geladen);
  assert.equal(geladen.boats[boot.id].spaetFest, true, 'nach dem Laden liegt er fest');
  assert.equal(sim.lateArrivalPending(geladen, ctx), false);
  const tag = geladen.day;
  const ev = tickBis(geladen, ctx, () => geladen.day !== tag, 40);
  assert.ok(ev.some((e) => e.type === 'dayEnd'));
});

test('Bewertung: Anker mehr, im Gästebuch "nachts noch aufgenommen"', () => {
  const { ctx } = neu();
  const boot = { id: 1, wishesTotal: 0, wishesMet: 0, spaetDank: true, berthId: null };
  const mit = sim.ratingParts(ctx, boot);
  const ohne = sim.ratingParts(ctx, { ...boot, spaetDank: false });
  assert.equal(mit.spaet, ctx.rules.lateArrival.rating);
  assert.ok(mit.value >= ohne.value);
  const pp = gruendeAusAbreise({ type: 'departed', parts: mit });
  assert.ok(pp.plus.some((p) => p.key === 'spaet'));
  assert.match(satz({ id: 3, tag: 4, note: 4.5, art: 'abreise', gruende: [], plus: pp.plus }), /Nacht|Dunkeln|nachts/i);
});

test('Meldungstext', () => {
  assert.deepEqual(meldungText({ bootsname: 'Möwe' }, 'Kleinkreuzer'), { titel: 'Spätankömmling', satz: 'Kleinkreuzer „Möwe“ läuft im Dunkeln ein und sucht noch eine Box.' });
  assert.match(meldungText(null).satz, /^Ein Boot läuft im Dunkeln ein/);
});
