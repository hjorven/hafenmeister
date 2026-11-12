// Tests für web/js/save/plaetze.js (mehrere Speicherplätze, Probe-Kopie, Übernahme alter Stände)
// Ausführen im Repo-Ordner:  node --test tests/speicherplaetze.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _setStore, saveGame, loadGame, wrap, importText, importInhalt, sammlungText, exportFileName, SaveError,
} from '../web/js/save/storage.js';
import * as P from '../web/js/save/plaetze.js';
import { createState, deserialize } from '../web/js/state.js';

function memoryStore({ quota = Infinity } = {}) {
  const m = new Map();
  return {
    m,
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const size = [...m].reduce((n, [kk, vv]) => n + (kk === k ? 0 : vv.length), 0) + String(v).length;
      if (size > quota) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}

function frisch(store = memoryStore()) {
  _setStore(store);
  P._reset();
  return store;
}

const stand = (tag, extra = {}) => ({ ...createState({ seed: 100 + tag }), day: tag, ...extra });

test('erster Start ohne Spielstand: ein Platz mit Namensvorschlag', () => {
  frisch();
  const v = P.einrichten({ namensVorschlag: () => 'Möwenhafen' });
  assert.equal(v.plaetze.length, 1);
  assert.equal(v.plaetze[0].name, 'Möwenhafen');
  assert.equal(v.aktiv, v.plaetze[0].id);
  assert.equal(v.plaetze[0].info, null);
});

test('bestehender Spielstand wird zum ersten Platz und bleibt unverändert', () => {
  const s = frisch();
  const alt = stand(17, { money: 4321, stage: 3 });
  saveGame(alt);
  const vorher = s.getItem('hafenmeister.spielstand');
  const v = P.einrichten();
  assert.equal(v.plaetze.length, 1);
  assert.equal(v.plaetze[0].name, 'Mein Hafen');
  assert.deepEqual(v.plaetze[0].info, { stufe: 3, tag: 17, geld: 4321, region: 'ostsee' });
  assert.equal(s.getItem('hafenmeister.spielstand'), vorher, 'nichts umgeschrieben');
  assert.equal(loadGame().game.day, 17);
});

test('alter zweiter Speicherweg hafenmeister.save wird übernommen und danach gelöscht', () => {
  const s = frisch();
  const alt = stand(9, { money: 900 });
  s.setItem('hafenmeister.save', JSON.stringify(alt));
  const v = P.einrichten();
  assert.equal(s.getItem('hafenmeister.save'), null);
  assert.equal(v.plaetze.length, 1);
  assert.equal(loadGame().game.day, 9);
  assert.equal(deserialize(JSON.stringify(loadGame().game)).money, 900);
});

test('alter Stand neben neuem: wird ein eigener Platz, wenn es ein anderes Spiel ist', () => {
  const s = frisch();
  saveGame(stand(30));
  s.setItem('hafenmeister.save', JSON.stringify(stand(5, { seed: 999 })));
  const v = P.einrichten();
  assert.equal(v.plaetze.length, 2);
  assert.equal(v.plaetze[1].name, 'Älterer Hafen');
  assert.equal(P.platzLesen(v.plaetze[1].id).game.day, 5);
  assert.equal(loadGame().game.day, 30, 'laufender Hafen bleibt aktiv');
});

test('alter Stand mit gleichem Seed wie der laufende wird nicht doppelt angelegt', () => {
  const s = frisch();
  const a = stand(30);
  saveGame(a);
  s.setItem('hafenmeister.save', JSON.stringify({ ...a, day: 2 }));
  const v = P.einrichten();
  assert.equal(v.plaetze.length, 1);
  assert.equal(s.getItem('hafenmeister.save'), null);
});

test('speichernAktiv trägt Name und Kurzinfo ein', () => {
  frisch();
  P.einrichten({ namensVorschlag: () => 'Haffwiek' });
  const st = stand(12, { money: 2500, stage: 2 });
  assert.equal(P.speichernAktiv(st), true);
  assert.equal(st.harborName, 'Haffwiek');
  const e = P.aktiverPlatz();
  assert.deepEqual(e.info, { stufe: 2, tag: 12, geld: 2500, region: 'ostsee' });
  assert.ok(e.gespielt);
  assert.equal(loadGame().game.harborName, 'Haffwiek');
});

test('neuer Platz, wechseln und zurück: kein Stand geht verloren', () => {
  const s = frisch();
  P.einrichten({ namensVorschlag: () => 'Erster' });
  const a = stand(40, { money: 7000 });
  P.speichernAktiv(a);
  const neu = createState({ seed: 5 });
  const id = P.platzAnlegen(neu, { name: 'Zweiter' });
  let v = P.verzeichnis();
  assert.equal(v.plaetze.length, 2);
  const erster = v.aktiv;
  // laufenden Stand mit neuerem Tag übergeben: wird vor dem Wechsel gespeichert
  P.wechseln(id, { ...a, day: 41 });
  v = P.verzeichnis();
  assert.equal(v.aktiv, id);
  assert.equal(loadGame().game.harborName, 'Zweiter');
  assert.equal(s.getItem(`hafenmeister.platz.${id}`), null, 'Ziel liegt jetzt unter dem aktiven Schlüssel');
  assert.equal(P.platzLesen(erster).game.day, 41);
  // nach dem Wechsel speichert dieser Tab nichts mehr (Seite wird neu geladen)
  assert.equal(P.speichernAktiv(stand(1)), false);
  // neuer Tab
  P._reset();
  P.einrichten();
  P.wechseln(erster, loadGame().game);
  assert.equal(loadGame().game.day, 41);
  assert.equal(P.platzLesen(id).game.harborName, 'Zweiter');
});

test('anderer Tab hat gewechselt: dieser Tab überschreibt nichts', () => {
  const s = frisch();
  P.einrichten();
  P.speichernAktiv(stand(3));
  const id = P.platzAnlegen(stand(50), { name: 'B' });
  // ein zweiter Tab stellt das Verzeichnis auf B um (wie wechseln dort)
  const v = JSON.parse(s.getItem('hafenmeister.plaetze'));
  s.setItem(`hafenmeister.platz.${v.aktiv}`, s.getItem('hafenmeister.spielstand'));
  s.setItem('hafenmeister.spielstand', s.getItem(`hafenmeister.platz.${id}`));
  v.aktiv = id;
  s.setItem('hafenmeister.plaetze', JSON.stringify(v));
  // dieser Tab läuft noch mit dem alten Hafen und darf B nicht überschreiben
  assert.equal(P.diesesTabAktiv(), false);
  assert.equal(P.speichernAktiv(stand(4)), false);
  assert.equal(loadGame().game.day, 50);
  assert.throws(() => P.wechseln(id, null), (e) => e.code === 'anderer-tab');
});

test('kopieren, umbenennen, überschreiben, löschen', () => {
  frisch();
  P.einrichten({ namensVorschlag: () => 'Kliffhafen' });
  P.speichernAktiv(stand(20));
  const v0 = P.verzeichnis();
  const kopie = P.kopieren(v0.aktiv);
  assert.equal(P.verzeichnis().plaetze.find((p) => p.id === kopie).name, 'Kliffhafen (Kopie)');
  assert.equal(P.platzLesen(kopie).game.day, 20);
  assert.equal(P.umbenennen(kopie, '  Reetbucht  '), 'Reetbucht');
  assert.equal(P.platzLesen(kopie).game.harborName, 'Reetbucht', 'Name steht auch im Spielstand');
  assert.equal(P.umbenennen(kopie, 'Kliffhafen'), 'Kliffhafen 2', 'Namen bleiben eindeutig');
  P.ueberschreiben(kopie, { ...stand(25), harborName: 'Kliffhafen' });
  assert.equal(P.platzLesen(kopie).game.day, 25);
  assert.throws(() => P.loeschen(v0.aktiv), (e) => e.code === 'aktiv');
  P.loeschen(kopie);
  assert.equal(P.verzeichnis().plaetze.length, 1);
  assert.equal(P.platzLesen(kopie), null);
});

test('höchstens MAX_PLAETZE Plätze', () => {
  frisch();
  P.einrichten();
  P.speichernAktiv(stand(1));
  for (let i = 1; i < P.MAX_PLAETZE; i++) P.platzAnlegen(stand(i), { name: `H${i}` });
  assert.equal(P.verzeichnis().plaetze.length, P.MAX_PLAETZE);
  assert.throws(() => P.platzAnlegen(stand(9), { name: 'zu viel' }), (e) => e instanceof SaveError && e.code === 'voll');
  assert.throws(() => P.kopieren(P.verzeichnis().aktiv), (e) => e.code === 'voll');
});

test('Probe-Kopie übernehmen ersetzt das Original', () => {
  frisch();
  P.einrichten({ namensVorschlag: () => 'Dünenort' });
  P.speichernAktiv(stand(30, { money: 50000 }));
  const original = P.verzeichnis().aktiv;
  const probe = P.kopieren(original, { probe: true });
  assert.equal(P.verzeichnis().plaetze.find((p) => p.id === probe).name, 'Probe: Dünenort');
  P.wechseln(probe, null);
  P._reset();
  P.einrichten();
  const laufend = loadGame().game;
  laufend.money = 1000; // teurer Ausbau
  P.speichernAktiv(laufend);
  assert.equal(P.probeUebernehmen(laufend), 'Dünenort');
  const v = P.verzeichnis();
  assert.equal(v.plaetze.length, 1);
  assert.equal(v.aktiv, original);
  assert.equal(loadGame().game.money, 1000);
  assert.equal(loadGame().game.harborName, 'Dünenort');
  assert.equal(P.speichernAktiv(laufend), true, 'weiterspielen ohne Neuladen');
});

test('Probe-Kopie verwerfen: zurück zum Original, Probe gelöscht', () => {
  const s = frisch();
  P.einrichten({ namensVorschlag: () => 'Dünenort' });
  P.speichernAktiv(stand(30, { money: 50000 }));
  const original = P.verzeichnis().aktiv;
  const probe = P.kopieren(original, { probe: true });
  P.wechseln(probe, null);
  P._reset();
  P.einrichten();
  P.speichernAktiv({ ...loadGame().game, money: 3 });
  assert.equal(P.probeVerwerfen(), original);
  const v = P.verzeichnis();
  assert.equal(v.plaetze.length, 1);
  assert.equal(v.aktiv, original);
  assert.equal(loadGame().game.money, 50000);
  assert.equal(v.papierkorb.length, 1, 'verworfene Probe liegt im Papierkorb');
  assert.equal(v.papierkorb[0].id, probe);
  assert.equal(s.getItem('hafenmeister.plaetze').includes('probeVon'), false);
});

test('Speicher voll beim Wechsel: beide Stände bleiben erhalten', () => {
  const s = frisch(memoryStore());
  P.einrichten();
  P.speichernAktiv(stand(10));
  const id = P.platzAnlegen(stand(60), { name: 'Groß' });
  const vorher = new Map(s.m);
  // ab jetzt passt nichts mehr hinein
  const setItem = s.setItem;
  s.setItem = (k, v) => { if (k.startsWith('hafenmeister.platz.') || k === 'hafenmeister.spielstand') { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; } return setItem(k, v); };
  assert.throws(() => P.wechseln(id, null), (e) => e.code === 'voll');
  s.setItem = setItem;
  assert.equal(loadGame().game.day, 10);
  assert.equal(P.platzLesen(id).game.day, 60);
  assert.equal(s.getItem('hafenmeister.plaetze'), vorher.get('hafenmeister.plaetze'));
});

test('Verzeichnis beschädigt: andere Plätze werden wiedergefunden', () => {
  const s = frisch();
  P.einrichten();
  P.speichernAktiv(stand(10));
  P.platzAnlegen({ ...stand(70), harborName: 'Strandhaferbucht' }, { name: 'Strandhaferbucht' });
  s.setItem('hafenmeister.plaetze', '{kaputt');
  P._reset();
  const v = P.einrichten();
  assert.equal(v.plaetze.length, 2);
  assert.ok(v.plaetze.some((p) => p.name === 'Strandhaferbucht' && p.info.tag === 70));
  assert.equal(loadGame().game.day, 10);
});

test('Import liest auch den alten Kurztext HM1:', () => {
  frisch();
  const alt = { ...createState({ seed: 11 }), harborName: 'Hafen Großenbrode Süd' };
  const bytes = new TextEncoder().encode(JSON.stringify(alt));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const code = `HM1:${btoa(bin)}`;
  assert.deepEqual(importText(code), alt);
  assert.deepEqual(importText(`  ${code}\n`), alt);
  assert.throws(() => importText('HM1:%%%'), (e) => e.code === 'ungueltig');
  P.einrichten();
  const id = P.importieren(importText(code));
  assert.equal(P.verzeichnis().plaetze.find((p) => p.id === id).name, 'Hafen Großenbrode Süd');
});

test('Dateiname mit Hafenname', () => {
  assert.equal(exportFileName(new Date(2026, 0, 5, 12), 'Möwenhafen Süd'), 'hafenmeister-moewenhafen-sued-2026-01-05.json');
  assert.equal(exportFileName(new Date(2026, 0, 5, 12), ''), 'hafenmeister-2026-01-05.json');
});

test('Umschlag bleibt Version 1: alte Dateien lassen sich weiter laden', () => {
  frisch();
  const datei = JSON.stringify(wrap({ ...createState({ seed: 3 }), day: 77 }));
  P.einrichten();
  const id = P.importieren(importText(datei));
  assert.equal(P.platzLesen(id).game.day, 77);
});

test('Papierkorb: löschen, zurückholen, endgültig löschen, Grenze', () => {
  const s = frisch();
  P.einrichten({ namensVorschlag: () => 'A' });
  P.speichernAktiv(stand(1));
  const b = P.platzAnlegen(stand(22), { name: 'B' });
  P.bildSpeichern(b, 'data:image/jpeg;base64,AAAA');
  P.loeschen(b);
  let v = P.verzeichnis();
  assert.equal(v.plaetze.length, 1);
  assert.equal(v.papierkorb[0].name, 'B');
  assert.ok(v.papierkorb[0].geloescht);
  assert.equal(P.wiederherstellen(b), 'B');
  assert.equal(P.platzLesen(b).game.day, 22);
  P.loeschen(b);
  P.endgueltigLoeschen(b);
  assert.equal(s.getItem(`hafenmeister.platz.${b}`), null);
  assert.equal(s.getItem(`hafenmeister.bild.${b}`), null);
  for (let i = 0; i < P.PAPIERKORB_MAX + 2; i++) P.loeschen(P.platzAnlegen(stand(i), { name: `X${i}` }));
  v = P.verzeichnis();
  assert.equal(v.papierkorb.length, P.PAPIERKORB_MAX);
  assert.equal(v.papierkorb[0].name, `X${P.PAPIERKORB_MAX + 1}`, 'neuester zuerst');
});

test('überschreiben legt den alten Stand in den Papierkorb', () => {
  frisch();
  P.einrichten({ namensVorschlag: () => 'A' });
  P.speichernAktiv(stand(1));
  const b = P.platzAnlegen(stand(33), { name: 'B' });
  P.ueberschreiben(b, { ...stand(2), harborName: 'A' });
  const v = P.verzeichnis();
  const alt = v.papierkorb.find((p) => p.name === 'B (überschrieben)');
  assert.ok(alt);
  const name = P.wiederherstellen(alt.id);
  assert.equal(P.platzLesen(P.verzeichnis().plaetze.find((p) => p.name === name).id).game.day, 33);
});

test('Speicher voll: Papierkorb wird geopfert, Spielstände nie', () => {
  const s = frisch(memoryStore({ quota: 53000 }));
  const gross = (tag) => stand(tag, { ballast: 'x'.repeat(10000) });
  P.einrichten();
  P.speichernAktiv(gross(1));
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(P.platzAnlegen(gross(10 + i), { name: `H${i}` }));
  for (const id of ids) P.loeschen(id);
  assert.equal(P.verzeichnis().papierkorb.length, 3);
  // neue Häfen passen nur, wenn der Papierkorb Platz macht
  for (let i = 0; i < 3; i++) P.platzAnlegen(gross(20 + i), { name: `N${i}` });
  const v = P.verzeichnis();
  assert.equal(v.plaetze.length, 4);
  assert.ok(v.papierkorb.length < 3);
  for (const p of v.plaetze) assert.ok(P.platzLesen(p.id), p.name);
  assert.ok(s.m.size > 0);
});

test('alle Häfen in einer Datei und zurück', () => {
  frisch();
  P.einrichten({ namensVorschlag: () => 'Eins' });
  P.speichernAktiv(stand(5));
  P.platzAnlegen(stand(6), { name: 'Zwei' });
  const text = sammlungText(P.alleStaende());
  const liste = importInhalt(text);
  assert.deepEqual(liste.map((x) => x.name), ['Eins', 'Zwei']);
  assert.deepEqual(liste.map((x) => x.spiel.day), [5, 6]);
  // einzelne Datei ergibt eine Liste mit einem Eintrag
  assert.equal(importInhalt(JSON.stringify(wrap({ ...stand(7), harborName: 'Sieben' })))[0].name, 'Sieben');
  assert.throws(() => importInhalt(JSON.stringify({ format: 'hafenmeister-sammlung', plaetze: 3 })), (e) => e.code === 'ungueltig');
});
