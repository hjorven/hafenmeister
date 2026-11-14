// Logbuch und Hafenchronik (Roadmap P21, docs/logbuch.md): Logik ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../web/js/sim.js';
import { createState, deserialize, serialize } from '../web/js/state.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { BOAT_CATALOG } from '../web/js/data/boat-catalog.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { typesFromModule, mergeTypes } from '../web/js/bridge.js';
import { unwrap, wrap, SAVE_VERSION } from '../web/js/save/storage.js';
import * as L from '../web/js/ui/logbuch-daten.js';

async function echteArten() {
  const mods = await Promise.all(['s', 'm', 'l', 'xl', 'xxl'].map((g) => import(`../web/js/data/boats/${g}.js`)));
  return mergeTypes(BOAT_CATALOG, mods.flatMap((m) => typesFromModule(m)));
}

async function neu(seed = 3, stufe = 3) {
  const ctx = sim.createContext({ boatTypes: await echteArten(), harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  const state = sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, stufe);
  return { ctx, state };
}

function spiele(state, ctx, tage) {
  const hilfe = { winter: () => sim.season(state, ctx).winter };
  const neue = [];
  for (let i = 0; i < tage; i++) {
    const ev = sim.runDay(state, ctx);
    neue.push(...L.verarbeite(state, ev, hilfe));
    sim.collectAll(state, ctx, true);
  }
  return neue;
}

test('jedes neue Modell steht mit Tag im Logbuch und in der Chronik seines Tages', async () => {
  const { ctx, state } = await neu();
  // Der Teststart legt schon fest liegende Boote hin (Fischer), die stehen vor dem Spiel im Logbuch
  const vorher = new Set(Object.values(state.logbook).flat());
  const neue = spiele(state, ctx, 12);
  const m = L.buchState(state);
  const imLogbuch = Object.values(state.logbook).flat().filter((k) => !vorher.has(k));
  assert.ok(imLogbuch.length >= 5, 'nach 12 Tagen sind einige Modelle da');
  assert.deepEqual(neue.map((n) => n.key).sort(), [...imLogbuch].sort(), 'jedes Modell wird genau einmal als neu gemeldet');
  for (const k of imLogbuch) {
    assert.ok(m.erst[k], `${k} hat einen Eintrag`);
    assert.ok(m.erst[k].tag >= 1 && m.erst[k].tag <= 12, `${k}: Tag`);
  }
  assert.deepEqual(m.chronik.map((z) => z.tag), [...Array(12)].map((_, i) => i + 1), 'jeder Tag eine Zeile');
  assert.equal(m.offen.length, 0, 'nach dem Abend ist nichts mehr offen');
  // Die Neuheiten stehen in der Zeile ihres Tages
  for (const k of imLogbuch) {
    const z = m.chronik.find((x) => x.tag === m.erst[k].tag);
    assert.ok(z.merk.some((x) => x.a === 'neu'), `Tag ${z.tag} erzählt von neuen Booten (${k})`);
  }
  // Zahlen stimmen mit dem Tagesbericht
  const v = state.stats.verlauf.at(-1);
  const z = m.chronik.at(-1);
  assert.equal(z.summe, v.summe);
  assert.equal(z.angelegt, v.angelegt);
});

test('Merkmale vor dem Abend gehören zum Tag, danach zum nächsten', () => {
  const state = createState({ seed: 1 });
  L.merken(state, { a: 'bau', name: 'Steg D' });
  L.merken(state, { a: 'bau', name: 'Steg D' });      // doppelt zählt einmal
  // Die Regeln melden den Abend erst nach dem Tick: der Tag ist dann schon weiter
  state.day = 2;
  L.merken(state, { a: 'ziel' });
  L.verarbeite(state, [{ type: 'dayEnd', day: 1, bericht: { tag: 1, stufe: 1, angelegt: 3, abgereist: 2, summe: 40, ruf: { nachher: 3.04 } } }]);
  L.merken(state, { a: 'ereignis', name: 'Sturm' });
  const m = L.buchState(state);
  assert.equal(m.chronik.length, 1);
  assert.deepEqual(m.chronik[0].merk, [{ a: 'bau', name: 'Steg D' }, { a: 'ziel' }]);
  assert.equal(m.chronik[0].ruf, 3);
  assert.deepEqual(L.offeneMerk(state, 2), [{ a: 'ereignis', name: 'Sturm' }]);
  // Kommt der Abend desselben Tags noch einmal, bleiben die Merkmale erhalten
  L.verarbeite(state, [{ type: 'dayEnd', day: 1, bericht: { tag: 1, stufe: 1, angelegt: 3, abgereist: 2, summe: 40 } }]);
  assert.equal(m.chronik.length, 1);
  assert.ok(m.chronik[0].merk.some((x) => x.a === 'bau'));
  assert.ok(m.chronik[0].merk.some((x) => x.a === 'ereignis'));
});

test('Sätze der Chronik: wichtigstes zuerst, Aufzählungen, ruhige Tage', () => {
  const s = L.saetze({ angelegt: 4, merk: [
    { a: 'stamm', name: 'Möwe' }, { a: 'stamm', name: 'Kormoran' },
    { a: 'neu', typ: 'Fahrtenyacht', name: 'Decksalonyacht', art: true },
    { a: 'stufe', stufe: 3 },
    { a: 'neu', typ: 'Fahrtenyacht', name: 'Regattayacht' },
    { a: 'bau', name: 'Steg D' },
  ] });
  assert.equal(s[0], 'Aufstieg auf Stufe 3.');
  assert.ok(s.includes('Zum ersten Mal da: Fahrtenyacht.'));
  assert.ok(s.includes('Neu im Logbuch: Regattayacht.'));
  assert.ok(s.includes('Gebaut: Steg D.'));
  assert.ok(s.includes('Neue Stammgäste: „Möwe“ und „Kormoran“.'));
  assert.equal(L.aufzaehlen(['Ruderboot', 'Beiboot und Schlauchboot']), 'Ruderboot sowie Beiboot und Schlauchboot');
  assert.equal(L.aufzaehlen(['A', 'B', 'C', 'D', 'E']), 'A, B und 3 weitere');
  assert.deepEqual(L.saetze({ angelegt: 0, gaeste: 0, merk: [] }), ['Ruhiger Tag, niemand hat angelegt.']);
  assert.deepEqual(L.saetze({ winter: true, merk: [] }), ['Winterruhe.']);
});

test('Chronik-Ansicht: neueste zuerst, Kapitel je Stufe, ruhige Wintertage zusammengefasst', () => {
  const z = (tag, stufe, extra = {}) => ({ tag, stufe, angelegt: 1, gaeste: 1, summe: 10, ruf: 3, merk: [], ...extra });
  const chronik = [z(1, 1), z(2, 1), z(3, 2, { merk: [{ a: 'stufe', stufe: 2 }] }), z(4, 2, { winter: true }), z(5, 2, { winter: true }), z(6, 2, { winter: true }), z(7, 2, { winter: true, merk: [{ a: 'bau', name: 'Mole' }] })];
  const k = L.chronikAnsicht(chronik);
  assert.deepEqual(k.map((x) => x.stufe), [2, 1]);
  assert.deepEqual(k[0].zeilen.map((x) => [x.tag, x.bis ?? null]), [[7, null], [4, 6], [3, null]]);
  assert.equal(L.tagTitel(k[0].zeilen[1]), 'Tag 4 bis 6 · Winterpause');
});

test('Katalog und Fortschritt: alle Modelle aller Größen, gesehene werden gezählt', async () => {
  const arten = await echteArten();
  const kat = L.katalog(arten);
  assert.deepEqual(kat.map((g) => g.size), ['S', 'M', 'L', 'XL', 'XXL']);
  const alle = kat.flatMap((g) => g.arten.flatMap((a) => a.modelle));
  assert.ok(alle.length >= 80, `über 80 Modelle (${alle.length})`);
  assert.equal(new Set(alle.map((m) => m.id)).size, alle.length, 'IDs eindeutig');
  for (const m of alle) {
    assert.ok(m.name, `${m.id} hat einen Namen`);
    assert.ok(m.length > 0, `${m.id} hat eine Länge`);
    assert.ok(m.minStage <= 6, `${m.id} kommt spätestens in Stufe 6`);
  }
  const state = createState({ seed: 1 });
  state.logbook = { S1: ['S1-1', 'S1-2'], L1: ['L1-3'] };
  const f = L.fortschritt(state, kat);
  assert.equal(f.gesehen, 3);
  assert.equal(f.arten, 2);
  assert.equal(f.je.S.gesehen, 2);
  assert.equal(f.gesamt, alle.length);
});

test('Spielstand Version 2 wird Version 3: Logbuch bleibt, letzte Tage kommen in die Chronik', async () => {
  assert.equal(SAVE_VERSION, 3);
  const { ctx, state } = await neu(9, 2);
  spiele(state, ctx, 34);
  // So sah ein Stand vor P21 aus: kein modules.logbuch
  const alt = JSON.parse(serialize(state));
  delete alt.modules.logbuch;
  alt.modules.aufstieg = { chronik: { 1: { abTag: 1 }, 2: { abTag: 20 } } };
  const { game } = unwrap({ format: 'hafenmeister-spielstand', version: 2, spiel: alt });
  const m = game.modules.logbuch;
  assert.ok(m, 'Logbuch angelegt');
  for (const k of Object.values(game.logbook).flat()) assert.deepEqual(m.erst[k], { tag: null, stufe: null });
  const verlauf = state.stats.verlauf;
  assert.equal(m.chronik[0].vorher, true, 'erste Zeile fasst die Tage vor dem Verlauf zusammen');
  assert.equal(m.chronik[0].bis, verlauf[0].tag - 1);
  assert.deepEqual(m.chronik.slice(1).map((z) => z.tag), verlauf.map((b) => b.tag));
  assert.ok(m.chronik.find((z) => z.tag === 20).merk.some((x) => x.a === 'stufe' && x.stufe === 2), 'Aufstieg aus der Chronik des Aufstiegs');
  assert.equal(m.ab, state.day);
  // Der umgebaute Stand lädt mit der strengen Prüfung und spielt weiter
  const geladen = deserialize(JSON.stringify(game));
  spiele(geladen, ctx, 2);
  assert.equal(L.buchState(geladen).chronik.at(-1).tag, state.day + 1);
  // Version 1 kommt über beide Schritte an
  const v1 = unwrap({ format: 'hafenmeister-spielstand', version: 1, spiel: createState({ seed: 2 }) }).game;
  assert.ok(Array.isArray(v1.modules.logbuch.chronik));
  assert.equal(v1.modules.gelaende.nr, 1);
  // Ein Stand mit Logbuch wird nicht noch einmal umgebaut
  const mit = unwrap(JSON.parse(JSON.stringify(wrap(game)))).game;
  assert.deepEqual(mit.modules.logbuch, game.modules.logbuch);
});

test('beschädigte Logbuch-Daten werden beim Laden gesäubert statt das Spiel anzuhalten', () => {
  const s = createState({ seed: 4 });
  s.logbook = { S1: ['S1-1', 'S1-1', 7, null], M1: 'kaputt', L1: ['L1-1'] };
  s.modules.logbuch = { erst: { 'S1-1': { tag: 'x' }, bad: 5 }, chronik: [{ tag: 3, merk: 'x' }, null, { tag: -1 }], offen: [{ t: 1, a: 'ziel' }, 7], ungelesen: ['S1-1', 3] };
  const g = deserialize(JSON.stringify(s));
  assert.deepEqual(g.logbook, { S1: ['S1-1'], L1: ['L1-1'] });
  const m = L.saeubern(g);
  assert.deepEqual(m.erst, { 'S1-1': { tag: null, stufe: null } });
  assert.deepEqual(m.chronik, [{ tag: 3, merk: [] }]);
  assert.deepEqual(m.offen, [{ t: 1, a: 'ziel' }]);
  assert.deepEqual(m.ungelesen, ['S1-1']);
  // freie Texte werden gekürzt und von Steuerzeichen befreit
  L.merken(g, { a: 'text', text: `<b>${'x'.repeat(500)}</b>` });
  const t = L.offeneMerk(g).find((x) => x.a === 'text').text;
  assert.ok(t.length <= L.LOGBUCH.maxText && !/[<>]/.test(t));
});

test('lange Spiele: Chronik bleibt begrenzt', () => {
  const s = createState({ seed: 5 });
  for (let t = 1; t <= L.LOGBUCH.maxChronik + 50; t++) L.tagEintragen(s, { tag: t, stufe: 1, summe: 1 });
  const m = L.buchState(s);
  assert.equal(m.chronik.length, L.LOGBUCH.maxChronik);
  assert.equal(m.chronik[0].tag, 51);
  assert.ok(serialize(s).length < 400_000, 'Spielstand bleibt klein');
});

test('Texte für Steckbrief und fehlende Modelle', () => {
  assert.equal(L.masse({ length: 12, beam: 4, draft: 1.9 }), '12,0 m lang, 4,0 m breit, 1,9 m Tiefgang');
  assert.equal(L.erstText({ tag: 12, stufe: 3, boot: 'Möwe', hafen: 'Kappeln' }), 'Zuerst am Tag 12 (Stufe 3): „Möwe“ aus Kappeln.');
  assert.equal(L.erstText({ tag: null }), 'Schon vor dem Logbuch im Hafen gewesen.');
  assert.equal(L.fehltText({ minStage: 5 }, { minStage: 5 }, 3), 'Kommt ab Stufe 5');
  assert.equal(L.fehltText({ minStage: 6, unlock: 'kreuzfahrt' }, {}, 6), 'Kommt mit einem eigenen Anleger');
  assert.equal(L.fehltText({ minStage: 2 }, { minStage: 2 }, 3), 'Noch nicht gesehen');
});
