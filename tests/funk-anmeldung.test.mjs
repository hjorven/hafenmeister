// Anmeldung per Funk (Roadmap P28, docs/funk-anmeldung.md): morgens melden sich ein bis zwei Boote an,
// der Spieler kann eine Box frei halten, eingehaltene Reservierung bringt Bonus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { RULES } from '../web/js/data/rules.js';
import { ECONOMY } from '../web/js/data/economy.js';
import * as sim from '../web/js/sim.js';
import { boatTypes, berths } from './fixtures.mjs';

function context(over = {}) {
  const rules = structuredClone(RULES);
  rules.trips = null;
  Object.assign(rules, over);
  return sim.createContext({ boatTypes, berths, rules });
}

/** Spielstand in Stufe 3 mit Hafenmeister mit Funk, Morgen von Tag d noch nicht ausgewürfelt. */
function morgen(seed = 1, props = {}) {
  const s = createState({ seed });
  Object.assign(s, { stage: 3, office: 1, ratings: Array(20).fill(4) }, props);
  return s;
}

/** Ersten Tag mit mindestens einer Anmeldung suchen (Seeds sind fest, das Ergebnis also auch). */
function tagMitAnmeldung(ctx, mindestens = 1, props = {}) {
  for (let seed = 1; seed < 400; seed++) {
    const s = morgen(seed, props);
    const ev = sim.tick(s, ctx, 0);
    if (sim.announcedBoats(s).length >= mindestens) return { s, ev };
  }
  throw new Error('kein Tag mit Anmeldung gefunden');
}

const ereignis = (events, type) => events.filter((e) => e.type === type);
const bisAnkunft = (s, ctx, boot) => sim.tick(s, ctx, boot.arriveAt - s.clock + 0.5);

test('Zahlen aus economy.js: Anmeldung ab Hafenmeister mit Funk, Regeln vollständig', () => {
  const r = sim.rulesFromEconomy(ECONOMY);
  assert.equal(r.office.announce, 1, 'erste Bürostufe');
  assert.equal(r.office.announce, r.office.preview, 'gleich mit der Funk-Vorschau');
  for (const k of ['leadShare', 'twoShare', 'bonusShare', 'rating']) assert.ok(Number.isFinite(r.funk[k]), k);
  assert.ok(r.funk.leadShare > r.departWindow[1], 'angemeldete Boote kommen nach den Morgenabreisen');
  assert.ok(r.funk.leadShare < r.arrivalWindow, 'und vor Tagesende');
});

test('Ohne Funk keine Anmeldung, mit Funk ein bis zwei, nie zu früh, nie im Winter', () => {
  const ctx = context();
  let mit = 0, zwei = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ohne = morgen(seed, { office: 0 });
    sim.tick(ohne, ctx, 0);
    assert.equal(sim.announcedBoats(ohne).length, 0);
    const s = morgen(seed);
    const ev = sim.tick(s, ctx, 0);
    const a = sim.announcedBoats(s);
    assert.ok(a.length <= 2);
    if (a.length) {
      mit++;
      assert.deepEqual(ereignis(ev, 'announced')[0].boatIds.sort(), a.map((b) => b.id).sort());
    }
    if (a.length === 2) zwei++;
    for (const b of a) {
      assert.ok(b.arriveAt >= ctx.rules.funk.leadShare * ctx.rules.dayLength, 'genug Vorlauf');
      assert.equal(b.funk.platz, null);
    }
    // gleicher Seed, gleiche Anmeldungen (kein Spielzufall verbraucht)
    const t = morgen(seed);
    sim.tick(t, ctx, 0);
    assert.deepEqual(sim.announcedBoats(t).map((b) => b.id), a.map((b) => b.id));
    assert.equal(t.rng, s.rng);
  }
  assert.ok(mit > 150, `fast jeden Tag eine Anmeldung (${mit})`);
  assert.ok(zwei > 40 && zwei < 120, `manchmal zwei (${zwei})`);
  // Winter
  const w = morgen(1, { day: ctx.rules.seasonDays + 1 });
  sim.tick(w, ctx, 0);
  assert.equal(sim.announcedBoats(w).length, 0);
});

test('Anmeldung verbraucht keinen Zufall: Tagesablauf ist mit und ohne Funk derselbe', () => {
  const ctx = context();
  const a = morgen(7), b = morgen(7, { office: 0 });
  sim.tick(a, ctx, 0);
  sim.tick(b, ctx, 0);
  assert.deepEqual(a.upcoming.map((x) => [x.id, x.typeId, x.arriveAt]), b.upcoming.map((x) => [x.id, x.typeId, x.arriveAt]));
});

test('Box frei halten: beste passende Box, für andere gesperrt, Schild rot', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const frei = sim.reservableBerths(s, ctx, boot.id);
  assert.ok(frei.length > 0);
  const r = sim.reserveBerth(s, ctx, boot.id);
  assert.ok(r.ok);
  assert.equal(r.berthId, frei[0]);
  assert.equal(boot.funk.platz, frei[0]);
  assert.equal(ereignis(r.events, 'reserved').length, 1);
  assert.equal(sim.reservedFor(s, frei[0]), boot);
  assert.equal(sim.berthState(s, ctx, frei[0]), 'reserviert');
  // anderes Boot passt nicht hinein, das angemeldete schon
  const fremd = { id: 9999, size: boot.size, length: boot.length, beam: boot.beam, draft: boot.draft, wishes: [] };
  assert.equal(sim.hookWhyNotFit(s, ctx, fremd, ctx.berthById[frei[0]]), 'funk');
  assert.equal(sim.hookWhyNotFit(s, ctx, boot, ctx.berthById[frei[0]]), null);
  // andere Box wählen: alte wird frei
  const zweite = sim.reservableBerths(s, ctx, boot.id).find((id) => id !== frei[0]);
  const r2 = sim.reserveBerth(s, ctx, boot.id, zweite);
  assert.ok(r2.ok);
  assert.equal(sim.reservedFor(s, frei[0]), null);
  assert.equal(sim.berthState(s, ctx, frei[0]), 'frei');
  assert.equal(ereignis(r2.events, 'reservationReleased')[0].reason, 'moved');
  // Box, die nicht passt, geht nicht
  const klein = ctx.berths.find((b) => b.maxLength < boot.length && sim.berthAvailable(s, b));
  if (klein) assert.equal(sim.reserveBerth(s, ctx, boot.id, klein.id).ok, false);
  // Boot ohne Anmeldung geht nicht
  const nicht = s.upcoming.find((b) => !b.funk);
  if (nicht) assert.equal(sim.reserveBerth(s, ctx, nicht.id).reason, 'notAnnounced');
});

test('Eingehalten: Boot fährt ohne Boje direkt in die Box, Bonus und Viertelanker', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  const geld = s.money;
  const ev = bisAnkunft(s, ctx, boot);
  const ank = ereignis(ev, 'arrived').find((e) => e.boatId === boot.id);
  assert.ok(ank.direct, 'direkt in die Box');
  assert.equal(ank.reserved, berthId);
  assert.ok(!s.queue.includes(boot.id), 'nicht an der Boje');
  const lieg = s.boats[boot.id];
  assert.equal(lieg.status, 'moored');
  assert.equal(lieg.berthId, berthId);
  const bonus = ereignis(ev, 'reservationKept').find((e) => e.boatId === boot.id);
  assert.ok(bonus.amount > 0);
  assert.equal(bonus.amount, Math.round(sim.nightlyFee(s, ctx, lieg, 0) * ctx.rules.funk.bonusShare));
  assert.ok(s.money >= geld + bonus.amount, 'Bonus in der Kasse');
  assert.equal(sim.heute(s).details.liegegeld.funk, bonus.amount, 'im Tagesabschluss als Liegegeld (Funk)');
  // Bewertung: Viertelanker mehr
  const teile = sim.ratingParts(ctx, lieg);
  assert.equal(teile.funk, ctx.rules.funk.rating);
  const ohne = sim.ratingParts(ctx, { ...lieg, funk: null });
  assert.ok(teile.value >= ohne.value);
  // Box ist jetzt belegt, keine Reservierung mehr offen
  assert.equal(sim.reservedFor(s, berthId), null);
  assert.equal(sim.announcedBoats(s).some((b) => b.id === boot.id), false);
});

test('Nicht frei gehalten: Boot kommt normal an die Boje, kein Bonus', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const ev = bisAnkunft(s, ctx, boot);
  const ank = ereignis(ev, 'arrived').find((e) => e.boatId === boot.id);
  assert.ok(ank && !ank.reserved);
  assert.equal(ereignis(ev, 'reservationKept').length, 0);
});

test('Spieler legt das angemeldete Boot woanders hin: Reservierung verfällt ohne Bonus', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  // Box ist bei Ankunft noch belegt (Ablegen dauert): Boot wartet an der Boje
  s.leaving[berthId] = { boatId: 777, elapsed: 0, at: 0, off: true, total: 0 };
  ctx.rules.leaveMax = 1e6;
  const ev = bisAnkunft(s, ctx, boot);
  assert.ok(s.queue.includes(boot.id), 'wartet an der Boje auf seine Box');
  assert.ok(!ereignis(ev, 'moored').some((e) => e.boatId === boot.id));
  // das Büro / Selbst-Einfahren nimmt ihm die Box nicht weg und legt es nicht woanders hin
  s.office = 4;
  sim.tick(s, ctx, 20);
  assert.equal(s.boats[boot.id].status, 'waiting');
  // Spieler zieht es in eine andere Box
  const andere = sim.fittingBerths(s, ctx, boot.id).find((id) => id !== berthId);
  const r = sim.assign(s, ctx, boot.id, andere);
  assert.ok(r.ok);
  assert.equal(ereignis(r.events, 'reservationReleased')[0].reason, 'elsewhere');
  assert.equal(ereignis(r.events, 'reservationKept').length, 0);
  assert.equal(sim.reservedFor(s, berthId), null);
});

test('Wartet auf die eigene Box und fährt hinein, sobald sie frei ist; Geduld läuft nicht ab', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  s.leaving[berthId] = { boatId: 777, elapsed: 0, at: 0, off: true, total: 0 };
  ctx.rules.leaveMax = 1e6;
  bisAnkunft(s, ctx, boot);
  sim.markAtBuoy(s, ctx, boot.id);
  sim.tick(s, ctx, ctx.rules.queue.patience + 5);
  assert.equal(s.boats[boot.id]?.status, 'waiting', 'fährt nicht aus Ungeduld weg');
  sim.berthCleared(s, ctx, { berthId });
  const ev = sim.tick(s, ctx, 1);
  assert.equal(s.boats[boot.id].berthId, berthId);
  assert.ok(ereignis(ev, 'reservationKept').some((e) => e.boatId === boot.id));
});

test('Freigeben: Box wieder frei, keine Folgen; Abweisen und Tagesende lösen die Reservierung', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  const r = sim.releaseBerth(s, ctx, boot.id);
  assert.ok(r.ok);
  assert.equal(sim.berthState(s, ctx, berthId), 'frei');
  assert.equal(sim.releaseBerth(s, ctx, boot.id).ok, false, 'zweimal geht nicht');
  // wieder halten, Boot an der Boje abweisen
  const { berthId: b2 } = sim.reserveBerth(s, ctx, boot.id);
  s.leaving[b2] = { boatId: 777, elapsed: 0, at: 0, off: true, total: 0 };
  ctx.rules.leaveMax = 1e6;
  bisAnkunft(s, ctx, boot);
  const d = sim.dismiss(s, ctx, boot.id);
  assert.ok(d.ok);
  assert.equal(ereignis(d.events, 'reservationReleased')[0].reason, 'dismissed');
  assert.equal(sim.reservedFor(s, b2), null);
  // Tagesende: Reservierung für ein Boot, das nicht mehr kommt, verfällt
  const t = tagMitAnmeldung(ctx).s;
  const spaet = sim.announcedBoats(t).at(-1);
  sim.reserveBerth(t, ctx, spaet.id);
  spaet.arriveAt = ctx.rules.dayLength + 10;     // kommt heute nicht mehr
  const ev = sim.tick(t, ctx, ctx.rules.dayLength + 1);
  assert.ok(ereignis(ev, 'reservationReleased').some((e) => e.boatId === spaet.id && e.reason === 'evening'));
  assert.equal(sim.announcedBoats(t).length, 0);
});

test('Volles Becken: alle Bojen belegt, das angemeldete Boot fährt trotzdem in seine Box', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  // alle anderen Boxen belegen, alle Bojen voll
  for (const b of sim.availableBerths(s, ctx)) if (b.id !== berthId && !s.berths[b.id]) s.berths[b.id] = -1;
  for (let i = 0; i < sim.waitSpotCount(s, ctx); i++) {
    const id = s.nextId++;
    s.boats[id] = { id, typeId: 'S1', size: 'S', length: 4, beam: 1.4, draft: 0.2, wishes: [], status: 'waiting', waitSpot: i, atBuoy: true, atBuoySince: s.clock, waitingSince: s.clock, held: true };
    s.queue.push(id);
  }
  s.upcoming = [boot];
  const ev = bisAnkunft(s, ctx, boot);
  assert.equal(s.boats[boot.id]?.berthId, berthId);
  assert.ok(!ereignis(ev, 'turnedAway').some((e) => e.boatId === boot.id));
  // die Wartenden an der Boje durften die frei gehaltene Box vorher nicht nehmen
  assert.equal(s.berths[berthId], boot.id);
});

test('Stufenausbau: Reservierung auf wegfallendem Platz verfällt', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  // Platz fällt mit der nächsten Stufe weg
  ctx.berthById[berthId].stages = [s.stage];
  s.money = 1e7;
  s.stageGuests = 1e4;
  const r = sim.advanceStage(s, ctx, { prepaid: true });
  assert.ok(r.ok);
  assert.ok(ereignis(r.events, 'reservationReleased').some((e) => e.reason === 'rebuild'));
  assert.equal(boot.funk.platz, null);
});

test('Speichern und Laden: Anmeldung und frei gehaltene Box bleiben', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  sim.tick(s, ctx, 5);
  const t = deserialize(serialize(s));
  sim.settleWaiting(t);
  assert.equal(sim.reservedFor(t, berthId)?.id, boot.id);
  assert.equal(sim.berthState(t, ctx, berthId), 'reserviert');
  const b = sim.announcedBoats(t).find((x) => x.id === boot.id);
  const ev = sim.tick(t, ctx, b.arriveAt - t.clock + 0.5);
  assert.ok(ereignis(ev, 'reservationKept').some((e) => e.boatId === boot.id));
  // nach dem Laden kein zweiter Morgen: Anmeldungen nicht doppelt
  assert.equal(ereignis(ev, 'announced').length, 0);
});

test('Hafen schauen (autoAssign ohne Option) nimmt die frei gehaltene Box nicht', () => {
  const ctx = context();
  const { s } = tagMitAnmeldung(ctx);
  const boot = sim.announcedBoats(s)[0];
  const { berthId } = sim.reserveBerth(s, ctx, boot.id);
  // nur noch die frei gehaltene Box passt für ein wartendes gleich großes Boot
  for (const b of sim.availableBerths(s, ctx)) if (b.id !== berthId && !s.berths[b.id]) s.berths[b.id] = -1;
  const id = s.nextId++;
  s.boats[id] = { ...boot, id, funk: undefined, status: 'waiting', waitSpot: 0, atBuoy: true, atBuoySince: s.clock, waitingSince: s.clock };
  s.queue.push(id);
  const ev = sim.autoAssign(s, ctx);
  assert.equal(ereignis(ev, 'moored').length, 0);
  assert.equal(sim.fittingBerths(s, ctx, id).length, 0);
});

test('Dauerlauf: 3 Spiele à 40 Tage mit Freihalten, Tauschen, Freigeben, Abweisen; nie zwei Boote in einer Box', () => {
  for (const seed of [3, 11, 29]) {
    const ctx = context();
    const s = morgen(seed);
    let gehalten = 0, eingehalten = 0;
    for (let tag = 0; tag < 40; tag++) {
      const start = s.day;
      let schritt = 0;
      while (s.day === start && schritt++ < 400) {
        const ev = sim.tick(s, ctx, 1);
        eingehalten += ereignis(ev, 'reservationKept').length;
        // Spieler: jede Anmeldung mal halten, mal tauschen, mal freigeben
        for (const b of sim.announcedBoats(s)) {
          const k = (b.id + s.day + Math.floor(s.clock)) % 23;
          if (k === 0 && !b.funk.platz && sim.reserveBerth(s, ctx, b.id).ok) gehalten++;
          else if (k === 1 && b.funk.platz) sim.reserveBerth(s, ctx, b.id, sim.reservableBerths(s, ctx, b.id).find((p) => p !== b.funk.platz) ?? b.funk.platz);
          else if (k === 2 && b.funk.platz && b.id % 5 === 0) sim.releaseBerth(s, ctx, b.id);
        }
        // Wartende zuweisen, manche abweisen
        for (const id of [...s.queue]) {
          if (id % 7 === 0) { sim.dismiss(s, ctx, id); continue; }
          const p = sim.fittingBerths(s, ctx, id)[0];
          if (p) sim.assign(s, ctx, id, p);
        }
        // Invarianten
        const belegt = new Map();
        for (const [platz, id] of Object.entries(s.berths)) {
          assert.ok(!belegt.has(id) || id < 0, `Boot ${id} in zwei Boxen`);
          belegt.set(id, platz);
          const r = sim.reservedFor(s, platz);
          assert.ok(!r, `Box ${platz} belegt und zugleich frei gehalten`);
        }
        const plaetze = sim.announcedBoats(s).map((b) => b.funk.platz).filter(Boolean);
        assert.equal(new Set(plaetze).size, plaetze.length, 'eine Box für zwei Anmeldungen');
      }
    }
    assert.ok(gehalten > 3, `Seed ${seed}: gehalten ${gehalten}`);
    assert.ok(eingehalten > 0, `Seed ${seed}: eingehalten ${eingehalten}`);
  }
});
