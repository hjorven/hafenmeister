// Havaristen einschleppen (P37, docs/havarie.md): Regeln ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, serialize, deserialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import * as stamm from '../web/js/features/stammgaeste.js';
import * as hav from '../web/js/features/havarie.js';

function neu({ seed = 7, stufe = 3, ansicht = false, werft = null } = {}) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  stamm.haengeEin((n, f) => sim.addHook(ctx, n, f));
  hav.haengeEin((n, f) => sim.addHook(ctx, n, f), { ansicht: () => ansicht, werft: () => werft });
  const state = createState({ seed });
  state.stage = stufe;
  for (const b of ctx.berths) if (b.requires) state.buildings[b.requires] = 1;
  state.office = 1;
  return { ctx, state };
}

// Bis zum ersten Tag mit Havarist spielen (der Spieler weist nichts zu, das Büro auch nicht)
function bisHavarie(state, ctx, maxTage = 80) {
  for (let i = 0; i < maxTage; i++) {
    sim.tick(state, ctx, 0);
    const h = state.modules.havarie?.heute;
    if (h && h.tag === state.day && h.phase === 'geplant') {
      // Platz schaffen: der Hafen soll für diese Tests nicht voll sein (voller Hafen hat einen eigenen Test)
      for (const b of sim.mooredBoats(state).filter((x) => !x.stationed).slice(0, 6)) { delete state.berths[b.berthId]; delete state.boats[b.id]; }
      return h;
    }
    sim.runDay(state, ctx);
  }
  return null;
}

function tickBis(state, ctx, clock) {
  const ev = [];
  while (state.clock < clock && state.phase === 'day') ev.push(...sim.tick(state, ctx, 1));
  return ev;
}

test('Zahlen stehen in economy.js und passen zusammen', () => {
  const H = hav.HAV;
  assert.ok(H.abStufe >= 2);
  assert.ok(H.fruehestens > 0 && H.spaetestens < 0.8 && H.fruehestens < H.spaetestens);
  for (const [k, v] of Object.entries(H.anteil)) assert.ok(v > 0 && v < 0.5, `anteil ${k}`);
  assert.ok(H.anker > 0 && H.frist > 0 && H.pause >= 1);
  for (const k of ['S', 'M', 'L']) assert.ok(H.schlepplohn[k] > 0);
});

test('Havaristen kommen an einem Teil der Tage, nie am ersten Tag, nie in Stufe 1, nie im Winter, mit Pause', () => {
  for (const stufe of [1, 2, 3, 4, 5, 6]) {
    const { ctx, state } = neu({ seed: 11, stufe });
    const tage = [];
    for (let i = 0; i < 120; i++) {
      sim.tick(state, ctx, 0);
      const h = state.modules.havarie?.heute;
      if (h && h.tag === state.day) tage.push({ tag: state.day, winter: sim.season(state, ctx).winter });
      sim.runDay(state, ctx);
    }
    if (stufe === 1) { assert.equal(tage.length, 0); continue; }
    assert.ok(tage.length >= 4 && tage.length <= 30, `Stufe ${stufe}: ${tage.length} Havaristen in 120 Tagen`);
    for (let i = 0; i < tage.length; i++) {
      assert.ok(tage[i].tag > 1);
      assert.ok(!tage[i].winter, `Tag ${tage[i].tag} im Winter`);
      if (i) assert.ok(tage[i].tag - tage[i - 1].tag >= hav.HAV.pause, `Pause ${tage[i - 1].tag} -> ${tage[i].tag}`);
    }
  }
});

test('Auswahl verbraucht keinen Spielzufall: gleiche Gäste mit und ohne Havaristen', () => {
  const a = neu({ seed: 5, stufe: 3 });
  const ctx2 = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN });
  stamm.haengeEin((n, f) => sim.addHook(ctx2, n, f));
  const b = { ctx: ctx2, state: createState({ seed: 5 }) };
  b.state.stage = 3;
  for (const x of ctx2.berths) if (x.requires) b.state.buildings[x.requires] = 1;
  b.state.office = 1;
  for (let i = 0; i < 12; i++) {
    sim.tick(a.state, a.ctx, 0); sim.tick(b.state, b.ctx, 0);
    const ta = a.state.upcoming.map((x) => `${x.typeId}:${x.arriveAt}`);
    const tb = b.state.upcoming.map((x) => `${x.typeId}:${x.arriveAt}`);
    assert.deepEqual(ta, tb, `Tag ${a.state.day}`);
    // beide Tage gleich enden lassen: der Havarist wird abgelehnt
    hav.ablehnen(a.state);
    sim.runDay(a.state, a.ctx); sim.runDay(b.state, b.ctx);
  }
});

test('der Havarist taucht zur geplanten Zeit auf, das Boot passt in den Hafen und hat einen Schaden', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3 });
  const h = bisHavarie(state, ctx);
  assert.ok(h);
  assert.ok(sim.couldEverFit(state, ctx, h.boot));
  assert.ok(['S', 'M', 'L'].includes(h.boot.size));
  assert.ok(hav.GRUENDE[h.grund]);
  assert.equal(typeof h.boot.bootsname, 'string');
  const ev = tickBis(state, ctx, h.at + 1);
  assert.ok(ev.some((e) => e.type === 'havarie' && e.phase === 'treibt'));
  assert.equal(h.phase, 'treibt');
  assert.ok(hav.plaetze(state, ctx).length > 0);
});

test('Box zuweisen: frei gehalten für den Havaristen, andere Boote passen nicht hinein', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  const platz = hav.plaetze(state, ctx)[0];
  const r = hav.zuweisen(state, ctx, platz, 'fischer');
  assert.ok(r.ok);
  assert.equal(h.phase, 'zugewiesen');
  assert.equal(h.helfer, 'fischer');
  assert.equal(sim.berthState(state, ctx, platz), 'reserviert');
  const fremd = { ...h.boot, id: 99999 };
  assert.equal(sim.hookWhyNotFit(state, ctx, fremd, ctx.berthById[platz]), 'havarie');
  // Eine Box, in die er nicht passt, geht nicht
  const zuKlein = sim.availableBerths(state, ctx).find((p) => !sim.fits(h.boot, p, ctx.rules, state.stage));
  if (zuKlein) assert.equal(hav.zuweisen(state, ctx, zuKlein.id).ok, false);
});

test('Einschleppen: Gast der Spielregeln, Liegegeld, Schlepplohn, Stammgast, besser bewertet', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  const platz = hav.plaetze(state, ctx)[0];
  hav.zuweisen(state, ctx, platz, 'fischer');
  const geld = state.money;
  const r = hav.einschleppen(state, ctx);
  assert.ok(r.ok);
  const b = state.boats[h.boot.id];
  assert.equal(b.status, 'moored');
  assert.equal(b.berthId, platz);
  assert.equal(state.berths[platz], b.id);
  assert.ok(b.havarie);
  assert.ok(r.events.some((e) => e.type === 'moored' && e.hand));
  assert.ok(r.events.some((e) => e.type === 'feeReady'));
  assert.ok(r.events.some((e) => e.type === 'stammgastNeu'));
  assert.equal(state.money - geld, hav.HAV.schlepplohn[b.size]);
  assert.equal(state.stats.today?.einnahmen?.sonstiges ?? sim.heute(state).einnahmen.sonstiges, hav.HAV.schlepplohn[b.size]);
  assert.equal(sim.heute(state).details.sonstiges.havarie, hav.HAV.schlepplohn[b.size]);
  const liste = stamm.stammState(state).liste;
  const g = liste.find((x) => x.stammId === b.stammId);
  assert.ok(g && g.stamm && b.stamm);
  const teile = sim.ratingParts(ctx, b);
  assert.equal(teile.havarie, hav.HAV.anker);
  assert.equal(h.phase, 'fest');
  assert.equal(state.modules.havarie.gerettet, 1);
  // Nachts reist er ab und bewertet; Stammgast bleibt auf der Liste
  sim.runDay(state, ctx);
  sim.runDay(state, ctx);
  assert.ok(!state.boats[b.id]);
  assert.ok(stamm.stammState(state).liste.some((x) => x.stammId === b.stammId));
});

test('mit Werft bleibt er zur Reparatur eine Nacht länger und hat den Dienst der Werft', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 4, werft: { naechte: 1, preis: 220 } });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  hav.zuweisen(state, ctx, hav.plaetze(state, ctx)[0], 'arbeitsboot');
  // ohne Ansicht: der nächste Tick schleppt sofort ein
  sim.tick(state, ctx, 1);
  const b = state.boats[h.boot.id];
  assert.ok(b);
  assert.equal(b.nights, 2);
  assert.equal(b.dienste.travellift, 'offen');
});

test('ohne Antwort holt ihn abends ein fremder Helfer: kein Abzug, zählt als verpasst', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3 });
  const h = bisHavarie(state, ctx);
  const ruf = state.ratings.length;
  const ev = [];
  while (state.phase === 'day') ev.push(...sim.tick(state, ctx, 1));
  ev.push(...sim.tick(state, ctx, 1));
  assert.ok(ev.some((e) => e.type === 'havarie' && e.phase === 'weg' && e.grund === 'abend'));
  assert.equal(h.phase, 'weg');
  assert.equal(state.modules.havarie.verpasst, 1);
  assert.ok(state.ratings.length >= ruf);
  assert.ok(!state.boats[h.boot.id]);
});

test('Ablehnen: weg, kein Boot, keine Bewertung', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3 });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  const n = state.ratings.length;
  const r = hav.ablehnen(state);
  assert.ok(r.ok);
  assert.equal(h.phase, 'weg');
  assert.equal(state.ratings.length, n);
  assert.equal(hav.zuweisen(state, ctx, sim.availableBerths(state, ctx)[0].id).ok, false);
});

test('ein laufender Schlepp ist abends fertig, auch mit Ansicht; Notfall nach einiger Zeit ohne Meldung', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  hav.zuweisen(state, ctx, hav.plaetze(state, ctx)[0], 'fischer');
  tickBis(state, ctx, state.clock + 30);
  assert.equal(h.phase, 'zugewiesen');
  while (state.phase === 'day') sim.tick(state, ctx, 1);
  sim.tick(state, ctx, 1);
  assert.equal(h.phase, 'fest');
  assert.ok(state.boats[h.boot.id]);
});

test('voller Hafen: keine Box frei, nichts zuzuweisen; wird eine frei, geht es', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 2 });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  // alle passenden Boxen belegen
  const frei = hav.plaetze(state, ctx);
  for (const id of frei) state.berths[id] = -1;
  assert.deepEqual(hav.plaetze(state, ctx), []);
  assert.equal(hav.zuweisen(state, ctx, frei[0]).ok, false);
  delete state.berths[frei[0]];
  assert.deepEqual(hav.plaetze(state, ctx), [frei[0]]);
  assert.ok(hav.zuweisen(state, ctx, frei[0], 'fischer').ok);
});

test('Box doch belegt beim Einschleppen: er nimmt die nächste freie, sonst ist er weg', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  const l = hav.plaetze(state, ctx);
  hav.zuweisen(state, ctx, l[0], 'fischer');
  state.berths[l[0]] = -1;
  const r = hav.einschleppen(state, ctx);
  assert.ok(r.ok);
  assert.notEqual(state.boats[h.boot.id].berthId, l[0]);
});

test('Speichern und Laden mitten im Schlepp: nichts geht verloren, nichts doppelt', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  const platz = hav.plaetze(state, ctx)[0];
  hav.zuweisen(state, ctx, platz, 'fischer');
  const st2 = deserialize(serialize(state));
  const h2 = st2.modules.havarie.heute;
  assert.equal(h2.phase, 'zugewiesen');
  assert.equal(h2.platz, platz);
  assert.equal(sim.berthState(st2, ctx, platz), 'reserviert');
  assert.ok(hav.einschleppen(st2, ctx).ok);
  assert.equal(Object.values(st2.boats).filter((b) => b.havarie).length, 1);
});

test('Stufenausbau: verschwindet die Box, treibt er wieder', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3, ansicht: true });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  hav.zuweisen(state, ctx, hav.plaetze(state, ctx)[0], 'fischer');
  const ev = [];
  hav.stufeHook({ state, gone: [h.platz], events: ev });
  assert.equal(h.phase, 'treibt');
  assert.equal(h.platz, null);
  assert.ok(ev.some((e) => e.type === 'havarie' && e.phase === 'treibt'));
});

test('neuer Tag räumt den Rest von gestern auf', () => {
  const { ctx, state } = neu({ seed: 3, stufe: 3 });
  const h = bisHavarie(state, ctx);
  tickBis(state, ctx, h.at + 1);
  state.modules.havarie.heute.tag = state.day - 1;   // wie nach einem Laden über Mitternacht
  hav.planen(state, ctx);
  assert.ok(!state.modules.havarie.heute || state.modules.havarie.heute.tag === state.day);
});

test('Bewertung und Rechnung: ein eingeschleppter Gast bewertet um den Havarie-Anker besser', () => {
  const { ctx } = neu();
  const b = { wishes: [], wishesTotal: 0, wishesMet: 0, berthId: null };
  const ohne = sim.ratingParts(ctx, b);
  const mit = sim.ratingParts(ctx, { ...b, havarie: { grund: 'motor' } });
  assert.equal(mit.havarie, hav.HAV.anker);
  assert.equal(ohne.havarie, 0);
  assert.ok(mit.value >= ohne.value);
});
