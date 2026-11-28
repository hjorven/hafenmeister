// Bootsgeschichten (docs/bootsgeschichten.md, Abschnitt 4): Anlass je Boot, Wiederholschutz,
// Bedingungen (Stufe, Größe, gebaute Angebote, Wetter, Ereignis), Texte. Mit den echten Zahlen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../web/js/state.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { GESCHICHTEN, CREW } from '../web/js/data/geschichten.js';
import * as sim from '../web/js/sim.js';
import * as G from '../web/js/geschichten/regeln.js';

const rules = sim.rulesFromEconomy(ECONOMY);

function kontext(umfeld = () => ({})) {
  const ctx = sim.createContext({ boatTypes: BOAT_CATALOG, harbor: HAFEN, rules });
  G.installiere(ctx, sim, { umfeld });
  return ctx;
}

test('Katalog: 50 Alltagsgeschichten, 14 für besondere Tage, Zahlen in economy.js, Texte gültig', () => {
  const alltag = GESCHICHTEN.filter((g) => g.art !== 'besonders');
  const besonders = GESCHICHTEN.filter((g) => g.art === 'besonders');
  assert.ok(alltag.length >= 50, `${alltag.length} Alltagsgeschichten`);
  assert.equal(besonders.length, 14);
  assert.equal(new Set(GESCHICHTEN.map((g) => g.id)).size, GESCHICHTEN.length, 'ids eindeutig');
  const ereignisse = Object.keys(ECONOMY.ereignisse);
  for (const g of GESCHICHTEN) {
    const z = ECONOMY.geschichten.anlaesse[g.id];
    assert.ok(z && z.g > 0, `Zahlen für ${g.id}`);
    assert.ok(Array.isArray(z.kommt) && z.kommt[0] < z.kommt[1], `kommt ${g.id}`);
    if (g.art === 'kurz') assert.ok(z.bleibt, `bleibt ${g.id}`);
    assert.ok(g.texte.length >= 1 && g.titel && g.logbuch, g.id);
    for (const t of g.texte) {
      assert.ok(!/\{von\}/.test(t), `kein {von} in ${g.id}`);
      if (/\{detail\}/.test(t)) assert.ok(g.details?.length, `details für ${g.id}`);
    }
    if (g.ereignis) assert.ok(ereignisse.includes(g.ereignis), `Ereignis ${g.ereignis}`);
    if (g.braucht?.service) assert.ok(ECONOMY.services[g.braucht.service], `Service ${g.braucht.service}`);
    if (g.braucht?.bauwerk) assert.ok(ECONOMY.bauwerke[g.braucht.bauwerk], `Bauwerk ${g.braucht.bauwerk}`);
  }
  for (const id of Object.keys(ECONOMY.geschichten.anlaesse)) assert.ok(G.BY_ID[id], `Zahlen ohne Geschichte: ${id}`);
  assert.ok(CREW.length >= 8);
});

test('Jedes neue Boot hat eine passende Geschichte, Art passt zur Aufenthaltsdauer', () => {
  const ctx = kontext();
  for (let stufe = 1; stufe <= 6; stufe++) {
    const s = sim.applyTestStage(createState({ seed: 10 + stufe, rules }), ctx, stufe);
    for (let tag = 0; tag < 3; tag++) {
      sim.runDay(s, ctx);
      for (const b of s.upcoming) {
        // Flottillen (P32): die Gruppe ist ihre Geschichte (Bootskarte nennt Anlass und Namen)
        if (b.special || b.size === 'XXL' || b.flotte) continue;
        assert.ok(b.story, `Boot ${b.typeId} Stufe ${stufe} ohne Geschichte`);
        const g = G.BY_ID[b.story.id];
        assert.ok(g.abStufe <= stufe, `${g.id} erst ab Stufe ${g.abStufe}`);
        assert.ok(!g.groessen || g.groessen.includes(b.size), `${g.id} passt nicht zu ${b.size}`);
        if (g.art === 'kurz') assert.equal(b.nights, 0, g.id);
        if (g.art === 'nacht') assert.equal(b.nights, 1, g.id);
        if (g.art === 'mehr') assert.ok(b.nights >= 2, g.id);
        if (b.nights === 0) assert.ok(b.stay > 0 && b.stay <= 0.5);
        const t = G.text(b);
        assert.ok(t && t.length > 10 && !/[{}]/.test(t), t);
      }
    }
  }
});

test('Ohne gebautes Angebot kommt keine Geschichte, die es braucht', () => {
  const ctx = kontext();
  const s = sim.applyTestStage(createState({ seed: 4, rules }), ctx, 4);
  s.facilities = { wc: 1 };
  const gesehen = new Set();
  for (let tag = 0; tag < 8; tag++) { sim.runDay(s, ctx); for (const b of s.upcoming) if (b.story) gesehen.add(b.story.id); }
  for (const id of gesehen) {
    const g = G.BY_ID[id];
    if (g.braucht?.bauwerk) assert.ok(s.facilities[g.braucht.bauwerk] > 0, `${id} braucht ${g.braucht.bauwerk}`);
    if (g.braucht?.service) assert.fail(`${id} braucht ${g.braucht.service}, nicht gebaut`);
  }
  assert.ok(gesehen.size >= 12, `nur ${gesehen.size} verschiedene Geschichten`);
});

test('Wiederholung: selten am selben Tag, fast nie zweimal im selben Abschnitt, keine Kombination doppelt', () => {
  const ctx = kontext();
  const s = sim.applyTestStage(createState({ seed: 21, rules }), ctx, 5);
  s.facilities = { wc: 2, dusche: 2, essen: 2, diesel: 1 };
  const grenzen = ECONOMY.geschichten.abschnitte;
  const kombis = new Set();
  let boote = 0, doppelt = 0, verschieden = new Set();
  for (let tag = 0; tag < 10; tag++) {
    sim.runDay(s, ctx);
    const seen = new Set();
    for (const b of s.upcoming) {
      if (!b.story) continue;
      boote++;
      verschieden.add(b.story.id);
      const k = `${b.story.id}@${G.abschnitt(b.arriveAt / rules.dayLength, grenzen)}`;
      // Doppelte werden getauscht oder neu gewählt; nur wenn im Abschnitt schon alle passenden Geschichten
      // vorkommen, bleibt eine doppelt (Befund P31: Seed-Abhängigkeit, rund 1 von 2000 Booten)
      if (seen.has(k)) doppelt++;
      seen.add(k);
      const key = G.kombiSchluessel(b.story);
      assert.ok(!kombis.has(key), `Kombination doppelt: ${key}`);
      kombis.add(key);
    }
    // keine Wellen: Ankunftszeiten bleiben aufsteigend und mit Abstand
    const t = s.upcoming.map((b) => b.arriveAt);
    for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1]);
  }
  assert.ok(boote > 100);
  assert.ok(doppelt <= Math.max(1, boote / 300), `${doppelt} doppelte bei ${boote} Booten`);
  assert.ok(verschieden.size >= 20, `nur ${verschieden.size} Geschichten in 10 Tagen`);
});

test('Regatta: Teilnehmer kommen am Vortag, fahren am Regattatag morgens raus und abends zurück', () => {
  let regattaTag = 0;
  const ctx = kontext((st, tag = st.day) => (tag === regattaTag ? { ereignis: 'regatta', wetter: [] } : { wetter: [] }));
  const s = sim.applyTestStage(createState({ seed: 8, rules }), ctx, 4);
  sim.runDay(s, ctx);
  assert.ok(!s.upcoming.some((b) => G.BY_ID[b.story?.id]?.art === 'besonders'), 'im Alltag keine besonderen Anlässe');
  regattaTag = s.day + 1;   // morgen ist Regatta
  // heute (Vortag) kommen Teilnehmer
  const heute = s.upcoming.filter((b) => b.story?.id === 'regattateilnehmer');
  // die Boote von heute wurden schon am Morgen gewürfelt: neu würfeln lassen, indem ein neuer Tag beginnt
  assert.equal(heute.length, 0, 'gestern war noch kein Vorabend');
  const s2 = sim.applyTestStage(createState({ seed: 9, rules }), ctx, 4);
  regattaTag = s2.day + 1;
  sim.tick(s2, ctx, 0);
  const teil = s2.upcoming.filter((b) => b.story?.id === 'regattateilnehmer');
  assert.ok(teil.length >= 2, `${teil.length} Teilnehmer am Vorabend`);
  for (const b of teil) { assert.ok(!b.motor); assert.ok(b.nights >= 2); }
  // Alle Teilnehmer einfahren lassen und den Tag zu Ende spielen
  sim.tick(s2, ctx, rules.dayLength - 1);
  for (const id of [...s2.queue]) {
    const f = sim.fittingBerths(s2, ctx, id);
    if (f.length) sim.assign(s2, ctx, id, f[0]);
  }
  const drin = Object.values(s2.boats).filter((b) => b.story?.id === 'regattateilnehmer' && b.status === 'moored');
  assert.ok(drin.length >= 1, 'mindestens ein Teilnehmer liegt im Hafen');
  sim.tick(s2, ctx, rules.eveningLength + 2);   // Nacht, Regattatag beginnt
  assert.equal(s2.day, regattaTag);
  for (const b of drin) {
    const x = s2.boats[b.id];
    assert.ok(x?.trip?.regatta, `Teilnehmer ${b.id} fährt zur Regatta`);
    assert.ok(x.trip.out < rules.dayLength * 0.15 && x.trip.back > rules.dayLength * 0.5);
  }
  const ev = sim.tick(s2, ctx, rules.dayLength * 0.2);
  assert.ok(ev.some((e) => e.type === 'tripOut' && drin.some((b) => b.id === e.boatId)), 'morgens raus');
  const ev2 = sim.tick(s2, ctx, rules.dayLength * 0.7);
  assert.ok(ev2.some((e) => e.type === 'tripBack' && drin.some((b) => b.id === e.boatId)), 'nachmittags zurück');
  // sie bleiben noch eine Nacht
  for (const b of drin) assert.ok(s2.boats[b.id], 'übernachtet nach der Regatta');
  // am Tag nach der Regatta kein Ausflug mehr
  regattaTag = -1;
  sim.tick(s2, ctx, rules.eveningLength + rules.dayLength * 0.1 + 2);
  for (const b of drin) if (s2.boats[b.id]) assert.ok(!s2.boats[b.id].trip?.regatta);
});

test('Wetterworte und Abschnitte', () => {
  assert.deepEqual(G.wetterWorte({ rain: 1, wind: 1, fog: 0, sun: 0 }), ['regen', 'sturm']);
  assert.deepEqual(G.wetterWorte({ rain: 0, wind: 0.2, fog: 0, sun: 0.9 }), ['sonne']);
  assert.equal(G.abschnitt(0.05), 0);
  assert.equal(G.abschnitt(0.5), 2);
  assert.equal(G.abschnitt(0.99), 4);
});

test('Spielstand: Geschichten-Stand ist JSON, alte Boote ohne Geschichte geben keinen Text', () => {
  const ctx = kontext();
  const s = sim.applyTestStage(createState({ seed: 2, rules }), ctx, 3);
  sim.runDay(s, ctx);
  const kopie = JSON.parse(JSON.stringify(s));
  assert.deepEqual(kopie.modules.geschichten, s.modules.geschichten);
  assert.equal(G.text({ id: 1 }), null);
});
