// Tests für web/js/save/storage.js
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _setStore, saveGame, loadGame, hasSave, clearSave, wrap, unwrap, importText, exportText,
  exportFileName, daysSinceExport, readMeta, SaveError, SAVE_FORMAT, SAVE_VERSION,
} from '../web/js/save/storage.js';

function memoryStore({ quota = Infinity } = {}) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const size = [...m].reduce((n, [kk, vv]) => n + (kk === k ? 0 : vv.length), 0) + v.length;
      if (size > quota) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
  };
}

const spiel = { tag: 3, geld: 1200, ruf: 3.5, liegeplaetze: [{ id: 'A1', boot: null }] };

test('speichern und laden ergibt denselben Zustand', () => {
  _setStore(memoryStore());
  assert.equal(hasSave(), false);
  assert.equal(loadGame(), null);
  assert.equal(saveGame(spiel), true);
  assert.equal(hasSave(), true);
  const r = loadGame();
  assert.deepEqual(r.game, spiel);
  assert.equal(r.ausSicherung, false);
  assert.match(r.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(readMeta().zuletztGespeichert);
});

test('beschädigter Stand: Sicherung wird geladen', () => {
  const s = memoryStore();
  _setStore(s);
  saveGame({ ...spiel, tag: 1 });
  saveGame({ ...spiel, tag: 2 });
  s.m.set('hafenmeister.spielstand', '{kaputt');
  const r = loadGame();
  assert.equal(r.game.tag, 1);
  assert.equal(r.ausSicherung, true);
});

test('Speicher voll: saveGame gibt false zurück und alter Stand bleibt', () => {
  const s = memoryStore({ quota: 400 });
  _setStore(s);
  assert.equal(saveGame({ tag: 1 }), true);
  assert.equal(saveGame({ tag: 2, ballast: 'x'.repeat(1000) }), false);
  assert.equal(loadGame().game.tag, 1);
});

test('kein Speicher (privater Modus): nichts stürzt ab', () => {
  _setStore(null);
  // null heißt "neu ermitteln"; in Node gibt es kein localStorage
  const ohne = globalThis.localStorage;
  assert.equal(saveGame(spiel), ohne ? true : false);
  if (!ohne) {
    assert.equal(loadGame(), null);
    assert.equal(hasSave(), false);
    clearSave();
  }
});

test('clearSave löscht Stand und Sicherung', () => {
  _setStore(memoryStore());
  saveGame(spiel);
  saveGame(spiel);
  clearSave();
  assert.equal(loadGame(), null);
});

test('Export und Import ergeben denselben Zustand', () => {
  _setStore(memoryStore());
  const text = exportText(spiel);
  assert.deepEqual(importText(text), spiel);
  assert.deepEqual(importText('﻿' + text), spiel, 'BOM am Anfang stört nicht');
});

test('Import lehnt fremde und kaputte Dateien ab', () => {
  for (const t of ['', '   ', 'hallo', '[]', '{"a":1}', JSON.stringify({ format: SAVE_FORMAT, version: 1, spiel: [] })]) {
    assert.throws(() => importText(t), (e) => e instanceof SaveError && e.code === 'ungueltig', t);
  }
});

test('Import aus neuerer Spielversion wird mit eigenem Code abgelehnt', () => {
  const t = JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION + 1, spiel: {} });
  assert.throws(() => importText(t), (e) => e.code === 'zu-neu');
});

test('wrap lehnt Nicht-Objekte ab', () => {
  for (const g of [null, undefined, 3, 'x', []]) {
    assert.throws(() => wrap(g), SaveError);
  }
});

test('unwrap gibt Zeitstempel zurück', () => {
  const d = wrap(spiel, new Date('2026-11-11T10:00:00Z'));
  assert.equal(unwrap(d).savedAt, '2026-11-11T10:00:00.000Z');
});

test('Dateiname enthält das lokale Datum', () => {
  assert.equal(exportFileName(new Date(2026, 0, 5, 12)), 'hafenmeister-2026-01-05.json');
});

test('Tage seit Export', () => {
  const s = memoryStore();
  _setStore(s);
  assert.equal(daysSinceExport(), null);
  s.setItem('hafenmeister.meta', JSON.stringify({ zuletztExportiert: '2026-11-01T08:00:00Z' }));
  assert.equal(daysSinceExport(new Date('2026-11-11T09:00:00Z')), 10);
});
