// Flottillen (Roadmap P32, F3, docs/flottillen.md): drei bis fünf Boote einer Art kommen im Konvoi und
// wollen am selben Steg liegen. Zusammen gibt jede Crew Anker mehr, aufgeteilt weniger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { echterHafen, ECONOMY, rulesFromEconomy } from './regeln.mjs';
import { createState, serialize, deserialize } from '../web/js/state.js';
import * as sim from '../web/js/sim.js';
import { FLOTTILLEN_ARTEN, FLOTTILLEN_NAMEN } from '../web/js/data/flottillen.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';

const ctx = echterHafen();
const ereignis = (events, type) => events.filter((e) => e.type === type);

/** Spielstand in Stufe stage (alles der Stufe gebaut), Tag day, Morgen noch nicht ausgewürfelt. */
function stand(seed, { stage = 4, day = 5, office = 0, c = ctx } = {}) {
  const s = createState({ seed });
  sim.applyTestStage(s, c, stage);
  s.day = day;
  s.office = office;
  return s;
}

/** Ersten Morgen mit Flottille suchen (Seeds und Tage sind fest, das Ergebnis also auch). */
function morgenMitFlottille({ stage = 4, office = 0, c = ctx, ab = 1 } = {}) {
  for (let seed = ab; seed < ab + 400; seed++) {
    const s = stand(seed, { stage, office, c });
    const ev = sim.tick(s, c, 0);
    const boote = s.upcoming.filter((b) => b.flotte);
    if (boote.length) return { s, ev, boote, seed };
  }
  throw new Error('kein Tag mit Flottille gefunden');
}

/** Spielzeit bis kurz nach der Ankunft des letzten Boots der Flottille, ohne dass jemand von selbst einfährt. */
function bisAlleDa(s, boote) {
  const ev = [];
  const letzte = Math.max(...boote.map((b) => b.arriveAt));
  const alt = ctx.rules.queue.selfEnterAfter;
  ctx.rules.queue.selfEnterAfter = null;
  try {
    while (s.clock < letzte + 0.5) ev.push(...sim.tick(s, ctx, 0.5));
  } finally { ctx.rules.queue.selfEnterAfter = alt; }
  return ev;
}

/** Abend und Nacht durchlaufen, bis die Flottille abgereist ist; liefert die 'departed'-Ereignisse der Gruppe. */
function bisAbreise(s, fid) {
  const ids = new Set(sim.flotillaMembers(s, fid).map((b) => b.id));
  const out = [];
  const alt = ctx.rules.queue.selfEnterAfter;
  ctx.rules.queue.selfEnterAfter = null;
  try {
    for (let i = 0; i < 4000 && sim.flotillaMembers(s, fid).length; i++) {
      out.push(...sim.tick(s, ctx, 1).filter((e) => e.type === 'departed' && ids.has(e.boatId)));
    }
  } finally { ctx.rules.queue.selfEnterAfter = alt; }
  return out;
}

test('Zahlen aus economy.js: Flottillen ab Stufe 3, Anteil je Stufe, Bewertung zusammen und getrennt', () => {
  const r = rulesFromEconomy(ECONOMY).flotilla;
  assert.equal(r.fromStage, 3);
  for (const k of ['from', 'to', 'gap', 'together', 'apart']) assert.ok(Number.isFinite(r[k]) && r[k] > 0, k);
  assert.ok(r.from < r.to && r.to < 1);
  for (const st of [3, 4, 5, 6]) assert.ok(r.share[st] > 0 && r.share[st] < 0.5, `Anteil Stufe ${st}`);
  assert.ok(rulesFromEconomy(ECONOMY).office.special.flotilla, 'Flottille ist ein Sonderfall fürs Büro');
});

test('Bootsdaten: Jede Flottillen-Art hat group [3, bis 5] und Texte, sonst keine Art eine Gruppe ab 3', () => {
  for (const t of BOAT_CATALOG) {
    const g = Array.isArray(t.group) ? t.group : [1, 1];
    if (FLOTTILLEN_ARTEN[t.id]) {
      assert.ok(g[0] >= 3 && g[1] <= 5 && g[0] <= g[1], `${t.id} group ${g}`);
      assert.ok(FLOTTILLEN_ARTEN[t.id].anlass && FLOTTILLEN_ARTEN[t.id].mehrzahl);
    } else assert.ok(g[1] < 3, `${t.id} hat group ${g}, aber keinen Eintrag in data/flottillen.js`);
  }
  assert.ok(FLOTTILLEN_NAMEN.length >= 10 && new Set(FLOTTILLEN_NAMEN).size === FLOTTILLEN_NAMEN.length);
});

test('Keine Flottille vor Stufe 3, am ersten Tag oder im Winter; ab Stufe 3 an einem Teil der Tage', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = stand(seed, { stage: 2 });
    sim.tick(s, ctx, 0);
    assert.equal(s.upcoming.filter((b) => b.flotte).length, 0, 'Stufe 2');
    const e = stand(seed, { stage: 5, day: 1 });
    sim.tick(e, ctx, 0);
    assert.equal(e.upcoming.filter((b) => b.flotte).length, 0, 'erster Tag');
  }
  // Winter: Tag im Winter der Saison suchen
  const s = stand(3, { stage: 5 });
  for (let d = 5; d < 400; d++) {
    s.day = d;
    if (!sim.season(s, ctx).winter) continue;
    s.scheduledDay = 0;
    sim.tick(s, ctx, 0);
    assert.equal(s.upcoming.filter((b) => b.flotte).length, 0, `Wintertag ${d}`);
  }
  for (const stage of [3, 4, 5, 6]) {
    let mit = 0;
    const n = 200;
    for (let seed = 1; seed <= n; seed++) {
      const t = stand(seed, { stage });
      sim.tick(t, ctx, 0);
      if (t.upcoming.some((b) => b.flotte)) mit++;
    }
    const soll = ctx.rules.flotilla.share[stage];
    assert.ok(mit / n > soll * 0.5 && mit / n < soll * 1.6, `Stufe ${stage}: ${mit} von ${n} Tagen, Soll ${soll}`);
  }
});

test('Eine Flottille: 3 bis 5 Boote einer Art, gleiche Herkunft, Konvoi im festen Abstand, gleich viele Nächte', () => {
  let gesehen = 0;
  for (let seed = 1; seed <= 300 && gesehen < 40; seed++) {
    const s = stand(seed, { stage: 3 + (seed % 4) });
    sim.tick(s, ctx, 0);
    const boote = s.upcoming.filter((b) => b.flotte).sort((a, b) => a.flotte.nr - b.flotte.nr);
    if (!boote.length) continue;
    gesehen++;
    const f = boote[0].flotte;
    assert.ok(boote.length >= 3 && boote.length <= 5, `${boote.length} Boote`);
    assert.equal(f.n, boote.length);
    assert.equal(f.id, boote[0].id, 'id der Flottille = erstes Boot');
    assert.ok(FLOTTILLEN_NAMEN.includes(f.name));
    assert.deepEqual(boote.map((b) => b.flotte.nr), boote.map((_, i) => i));
    assert.equal(new Set(boote.map((b) => b.typeId)).size, 1, 'eine Art');
    assert.ok(FLOTTILLEN_ARTEN[boote[0].typeId]);
    assert.equal(new Set(boote.map((b) => b.origin)).size, 1, 'gleiche Herkunft');
    assert.equal(new Set(boote.map((b) => b.nights)).size, 1, 'gleich viele Nächte');
    assert.ok(boote.every((b) => b.nights >= 1 && b.stay == null), 'kein Kurzhalt');
    assert.equal(new Set(boote.map((b) => b.wishes.join())).size, 1, 'gleiche Wünsche');
    for (let i = 1; i < boote.length; i++) {
      assert.ok(Math.abs(boote[i].arriveAt - boote[i - 1].arriveAt - ctx.rules.flotilla.gap) < 0.11, 'Konvoi-Abstand');
    }
    const L = ctx.rules.dayLength;
    // Erstes Boot etwa im Fenster fruehestens bis spaetestens (über die Reihenfolge des Tages), nie am Rand
    assert.ok(boote[0].arriveAt >= L * 0.2, `Spitze ${boote[0].arriveAt}`);
    assert.ok(boote.at(-1).arriveAt <= L * ctx.rules.arrivalWindow + 0.1, `Ende ${boote.at(-1).arriveAt}`);
    // Zu allen anderen Booten bleibt der Mindestabstand
    const t = s.upcoming.map((b) => b);
    for (let i = 1; i < t.length; i++) {
      if (t[i].flotte && t[i - 1].flotte) continue;
      assert.ok(t[i].arriveAt - t[i - 1].arriveAt >= ctx.rules.arrivalMinGap - 0.05, `Abstand ${t[i - 1].arriveAt} -> ${t[i].arriveAt}`);
    }
    if (FLOTTILLEN_ARTEN[boote[0].typeId].gleichesModell) assert.equal(new Set(boote.map((b) => b.modelId)).size, 1, 'gleiches Modell');
    // Ids eindeutig, Liste nach Ankunft sortiert, die Gruppe passt an einen Steg (so viele Plätze hat er)
    assert.equal(new Set(s.upcoming.map((b) => b.id)).size, s.upcoming.length);
    for (let i = 1; i < s.upcoming.length; i++) assert.ok(s.upcoming[i].arriveAt >= s.upcoming[i - 1].arriveAt);
    const proStegPlatz = new Map();
    for (const p of sim.availableBerths(s, ctx)) {
      if (!sim.fits(boote[0], p, ctx.rules, s.stage)) continue;
      const j = sim.jettyOf(p);
      proStegPlatz.set(j, (proStegPlatz.get(j) || 0) + 1);
    }
    assert.ok(Math.max(...proStegPlatz.values()) >= boote.length, 'ein Steg hat Platz für alle');
  }
  assert.ok(gesehen >= 20, `nur ${gesehen} Flottillen gesehen`);
});

test('Flottille ersetzt Boote des Tages: nicht mehr Gäste, und Tage ohne Flottille bleiben gleich (kein Spielzufall)', () => {
  const ohneRegel = echterHafen();
  ohneRegel.rules.flotilla = null;
  let verglichen = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const a = stand(seed, { stage: 4 });
    const b = stand(seed, { stage: 4, c: ohneRegel });
    sim.tick(a, ctx, 0);
    sim.tick(b, ohneRegel, 0);
    const mit = a.upcoming.some((x) => x.flotte);
    if (!mit) {
      assert.deepEqual(a.upcoming.map((x) => [x.typeId, x.length, x.arriveAt]), b.upcoming.map((x) => [x.typeId, x.length, x.arriveAt]), `Seed ${seed}`);
      assert.equal(a.rng, b.rng);
      verglichen++;
    } else {
      const flotte = a.upcoming.filter((x) => x.flotte).length;
      assert.ok(a.upcoming.length <= Math.max(b.upcoming.length, flotte), `Seed ${seed}: ${a.upcoming.length} statt ${b.upcoming.length}`);
    }
  }
  assert.ok(verglichen > 60);
});

test('Alle an einem Steg: jede Crew gibt Anker mehr; aufgeteilt weniger', () => {
  const { s, boote } = morgenMitFlottille();
  const fid = boote[0].flotte.id;
  bisAlleDa(s, boote);
  // Erstes Boot: gold leuchten Plätze an Stegen, an denen alle Platz haben
  const erstes = s.boats[boote[0].id];
  const gold = sim.wishBerths(s, ctx, erstes.id);
  assert.ok(gold.length >= 1);
  const steg = sim.jettyOf(ctx.berthById[gold[0]]);
  assert.ok(sim.flotillaTargets(s, ctx, erstes).has(steg));
  let ev = sim.assign(s, ctx, erstes.id, gold[0]).events;
  // Danach leuchten für die anderen nur noch Plätze an diesem Steg
  for (const b of boote.slice(1)) {
    const g = sim.wishBerths(s, ctx, b.id);
    assert.ok(g.length && g.every((p) => sim.jettyOf(ctx.berthById[p]) === steg), `Boot ${b.id}: ${g}`);
    const w = sim.berthValue(s, ctx, b.id, g[0]);
    assert.equal(w.flotte.zusammen, true);
    assert.equal(w.flotte.wert, ctx.rules.flotilla.together);
    ev = ev.concat(sim.assign(s, ctx, b.id, g[0]).events);
  }
  const fertig = ereignis(ev, 'flotillaComplete');
  assert.equal(fertig.length, 1);
  assert.equal(fertig[0].jetty, steg);
  assert.equal(ereignis(ev, 'moored').filter((e) => e.flotte === fid).length, boote.length);
  assert.equal(sim.flotillaState(s, ctx, fid).together, true);
  const ab = bisAbreise(s, fid);
  assert.equal(ab.length, boote.length);
  assert.ok(ab.every((e) => e.parts.flotte === ctx.rules.flotilla.together), JSON.stringify(ab.map((e) => e.parts.flotte)));
});

test('Aufgeteilt: Platzschild zeigt "getrennt", jede Crew gibt Anker weniger, einmal flotillaSplit', () => {
  const { s, boote } = morgenMitFlottille({ ab: 50 });
  const fid = boote[0].flotte.id;
  bisAlleDa(s, boote);
  const erstes = s.boats[boote[0].id];
  const p1 = sim.fittingBerths(s, ctx, erstes.id)[0];
  sim.assign(s, ctx, erstes.id, p1);
  const steg = sim.jettyOf(ctx.berthById[p1]);
  const zweites = s.boats[boote[1].id];
  const fremd = sim.fittingBerths(s, ctx, zweites.id).find((p) => sim.jettyOf(ctx.berthById[p]) !== steg);
  assert.ok(fremd, 'ein anderer Steg passt');
  const w = sim.berthValue(s, ctx, zweites.id, fremd);
  assert.equal(w.flotte.zusammen, false);
  const gleich = sim.berthValue(s, ctx, zweites.id, sim.wishBerths(s, ctx, zweites.id)[0]);
  assert.ok(gleich.anchors > w.anchors, 'zusammen bringt mehr Anker');
  let ev = sim.assign(s, ctx, zweites.id, fremd).events;
  for (const b of boote.slice(2)) ev = ev.concat(sim.assign(s, ctx, b.id, sim.fittingBerths(s, ctx, b.id)[0]).events);
  assert.equal(ereignis(ev, 'flotillaSplit').length, 1);
  assert.equal(ereignis(ev, 'flotillaComplete').length, 0);
  assert.equal(sim.flotillaState(s, ctx, fid).together, false);
  const ab = bisAbreise(s, fid);
  assert.equal(ab.length, boote.length);
  assert.ok(ab.every((e) => e.parts.flotte === -ctx.rules.flotilla.apart));
});

test('Ein Boot weggeschickt: die Gruppe ist auseinander, die anderen geben Anker weniger', () => {
  const { s, boote } = morgenMitFlottille({ ab: 90 });
  const fid = boote[0].flotte.id;
  bisAlleDa(s, boote);
  const r = sim.dismiss(s, ctx, boote[0].id);
  assert.ok(r.ok);
  assert.equal(ereignis(r.events, 'flotillaSplit').length, 1);
  const st = sim.flotillaState(s, ctx, fid);
  assert.equal(st.zerrissen, true);
  assert.equal(st.together, false);
  const b = s.boats[boote[1].id];
  const w = sim.berthValue(s, ctx, b.id, sim.fittingBerths(s, ctx, b.id)[0]);
  assert.equal(w.flotte.zusammen, false);
  for (const x of boote.slice(1)) sim.assign(s, ctx, x.id, sim.wishBerths(s, ctx, x.id)[0] ?? sim.fittingBerths(s, ctx, x.id)[0]);
  const ab = bisAbreise(s, fid);
  assert.equal(ab.length, boote.length - 1);
  assert.ok(ab.every((e) => e.parts.flotte === -ctx.rules.flotilla.apart));
});

test('Selbst einfahren und Vorschlag des Büros halten die Gruppe zusammen, die Leitstelle lässt sie dem Spieler', () => {
  let zusammen = 0, gesamt = 0;
  for (let ab = 1; ab < 200 && gesamt < 15; ab += 13) {
    const { s, boote } = morgenMitFlottille({ ab });
    const fid = boote[0].flotte.id;
    const letzte = Math.max(...boote.map((b) => b.arriveAt));
    while (s.clock < letzte + 120 && sim.flotillaState(s, ctx, fid)?.liegen < boote.length) sim.tick(s, ctx, 1);
    const st = sim.flotillaState(s, ctx, fid);
    if (!st || st.liegen < st.n) continue;
    gesamt++;
    if (st.together) zusammen++;
  }
  assert.ok(gesamt >= 8, `nur ${gesamt} Flottillen ganz fest`);
  assert.ok(zusammen >= gesamt - 1, `${zusammen} von ${gesamt} zusammen`);
  // Büro mit Automatik: Sonderfall 'flottille', Vorschlag am Steg der Gruppe, kein selbstständiges Zuweisen
  const { s, boote } = morgenMitFlottille({ office: 4, ab: 7 });
  assert.ok(sim.officeAutomatic(s, ctx));
  const alt = ctx.rules.queue.selfEnterAfter;
  ctx.rules.queue.selfEnterAfter = null;
  try {
    while (s.clock < boote[0].arriveAt + 0.5) sim.tick(s, ctx, 0.5);
  } finally { ctx.rules.queue.selfEnterAfter = alt; }
  const b = s.boats[boote[0].id];
  // Ohne frei gehaltene Box (Funk "Nein") ist es ein Sonderfall
  if (b.status === 'waiting') {
    assert.equal(sim.officeSpecialCase(s, ctx, b.id), 'flottille');
    const v = sim.officeProposal(s, ctx, b.id);
    assert.ok(v, 'Vorschlag trotzdem');
    assert.ok(sim.flotillaTargets(s, ctx, b).has(sim.jettyOf(ctx.berthById[v])));
    const vorher = Object.keys(s.berths).length;
    sim.autoAssign(s, ctx, { standardOnly: true });
    assert.equal(s.boats[b.id].status, 'waiting', 'Leitstelle weist nicht selbst zu');
    assert.ok(Object.keys(s.berths).length >= vorher);
  }
});

test('Funk: Flottille meldet sich als Gruppe an, Steg frei halten, alle fahren direkt hinein mit Bonus', () => {
  const { s, ev, boote } = morgenMitFlottille({ office: 1 });
  const fid = boote[0].flotte.id;
  const an = ereignis(ev, 'announced').find((e) => e.flotte === fid);
  assert.ok(an, 'Anmeldung der Flottille');
  assert.deepEqual(an.boatIds.sort((a, b) => a - b), boote.map((b) => b.id).sort((a, b) => a - b));
  assert.ok(boote.every((b) => b.funk && b.funk.platz === null));
  // Einzelanmeldungen nennen keine Flottillen-Boote
  for (const e of ereignis(ev, 'announced').filter((x) => x.flotte == null)) assert.ok(e.boatIds.every((id) => !boote.some((b) => b.id === id)));
  const wahl = sim.flotillaReservable(s, ctx, fid);
  assert.ok(wahl.length >= 1);
  for (const w of wahl) {
    const plaetze = Object.values(w.plaetze);
    assert.equal(plaetze.length, boote.length);
    assert.equal(new Set(plaetze).size, plaetze.length, 'jedes Boot eine eigene Box');
    assert.ok(plaetze.every((p) => sim.jettyOf(ctx.berthById[p]) === w.jetty));
  }
  const ziel = wahl.at(-1).jetty;
  const r = sim.reserveFlotilla(s, ctx, fid, ziel);
  assert.ok(r.ok);
  assert.equal(ereignis(r.events, 'reserved').length, boote.length);
  assert.ok(boote.every((b) => sim.jettyOf(ctx.berthById[b.funk.platz]) === ziel));
  // Anderer Steg: alte Boxen werden frei, neue gehalten
  if (wahl.length > 1) {
    const r2 = sim.reserveFlotilla(s, ctx, fid, wahl[0].jetty);
    assert.ok(r2.ok);
    assert.ok(boote.every((b) => sim.jettyOf(ctx.berthById[b.funk.platz]) === wahl[0].jetty));
    assert.equal(ereignis(r2.events, 'reservationReleased').length, boote.length);
  }
  const plaetze = boote.map((b) => b.funk.platz);
  // Frei gehaltene Boxen nimmt kein anderes Boot
  for (const p of plaetze) assert.equal(sim.reservedFor(s, p)?.flotte?.id, fid);
  const ev2 = bisAlleDa(s, boote);
  const fest = ereignis(ev2, 'moored').filter((e) => e.flotte === fid);
  assert.equal(fest.length, boote.length, 'alle direkt in ihre Box');
  assert.deepEqual(fest.map((e) => e.berthId).sort(), [...plaetze].sort());
  assert.equal(ereignis(ev2, 'reservationKept').length, boote.length);
  assert.equal(ereignis(ev2, 'flotillaComplete').length, 1);
  const ab = bisAbreise(s, fid);
  assert.ok(ab.every((e) => e.parts.flotte === ctx.rules.flotilla.together && e.parts.funk > 0));
});

test('Funk: Freigeben gibt alle Boxen frei; ohne Büro meldet sich keine Flottille', () => {
  const { s, boote } = morgenMitFlottille({ office: 1, ab: 30 });
  const fid = boote[0].flotte.id;
  assert.ok(sim.reserveFlotilla(s, ctx, fid).ok);
  const r = sim.releaseFlotilla(s, ctx, fid);
  assert.equal(ereignis(r.events, 'reservationReleased').length, boote.length);
  assert.ok(boote.every((b) => b.funk.platz === null));
  const o = morgenMitFlottille({ office: 0, ab: 30 });
  assert.ok(o.boote.every((b) => !b.funk));
});

test('Alle Bojen belegt: die Flottille geht trotzdem vor Anker statt einzeln abzudrehen', () => {
  const { s, boote } = morgenMitFlottille({ ab: 120 });
  // Bojen mit anderen Wartenden füllen
  const n = sim.waitSpotCount(s, ctx);
  for (let i = 0; i < n; i++) {
    const id = s.nextId++;
    s.boats[id] = { id, typeId: 'S1', name: 'Füller', size: 'S', length: 4, beam: 1.4, draft: 0.2, wishes: [], nights: 1, status: 'waiting', arriveAt: 0, waitingSince: s.clock, waitSpot: i, atBuoy: true, atBuoySince: s.clock, berthId: null, held: true, wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0 };
    s.queue.push(id);
  }
  // Keine freie Box, damit niemand direkt einfährt
  const ev = bisAlleDa(s, boote);
  assert.equal(ereignis(ev, 'turnedAway').filter((e) => boote.some((b) => b.id === e.boatId)).length, 0);
  assert.ok(boote.every((b) => s.boats[b.id]));
});

test('Speichern und Laden: Flottille, Lage und Funk bleiben erhalten', () => {
  const { s, boote } = morgenMitFlottille({ office: 1, ab: 60 });
  const fid = boote[0].flotte.id;
  sim.reserveFlotilla(s, ctx, fid);
  bisAlleDa(s, boote.slice(0, 1));
  const t = deserialize(serialize(s));
  assert.deepEqual(sim.flotillaMembers(t, fid).map((b) => [b.id, b.flotte.nr, b.funk?.platz]), sim.flotillaMembers(s, fid).map((b) => [b.id, b.flotte.nr, b.funk?.platz]));
  assert.deepEqual(sim.flotillaState(t, ctx, fid), sim.flotillaState(s, ctx, fid));
});

test('Spielstand ohne Flottillen (alt) und Regeln ohne Flottillen: nichts ändert sich', () => {
  const c = echterHafen();
  c.rules.flotilla = null;
  const s = stand(4, { stage: 5, c });
  for (let d = 0; d < 5; d++) sim.runDay(s, c);
  assert.equal(Object.values(s.boats).filter((b) => b.flotte).length, 0);
  // Regeln ohne Flottille, aber ein Boot mit flotte im Stand (Spielstand aus neuerer Version): kein Fehler
  const b = Object.values(s.boats)[0];
  if (b) b.flotte = { id: b.id, name: 'Test', n: 3, nr: 0, art: 'M1', palette: 0 };
  sim.runDay(s, c);
});
