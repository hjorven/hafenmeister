// Prüft die Roadmap-Übersicht (tools/roadmap.mjs): Erkennt sie alle Pakete aus
// docs/roadmap.md? Ob README und Bild aktuell sind, prüft hier niemand: das erledigt
// nach jedem Merge die Action "Roadmap-Übersicht" (.github/workflows/roadmap.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeuge, klasse, readmeEinsetzen, readmeAbschnitt } from '../tools/roadmap.mjs';

const md = readFileSync(new URL('../docs/roadmap.md', import.meta.url), 'utf8');
const d = erzeuge(md);

test('alle Pakete P01 bis P66 (außer dem freien P56) haben Titel und Welle', () => {
  for (let n = 1; n <= 66; n++) {
    if (n === 56) continue;
    const id = 'P' + String(n).padStart(2, '0');
    const p = d.pakete.find((x) => x.id === id);
    assert.ok(p, `${id} fehlt in den Pakettabellen`);
    assert.ok(p.titel.length > 3, `${id} ohne Titel`);
    assert.ok(Number.isInteger(p.welle), `${id} ohne Welle`);
  }
});

test('Wellen 0 bis 5 mit Titel, jede Zählung passt', () => {
  for (let n = 0; n <= 5; n++) {
    const w = d.wellen.find((x) => x.nr === n);
    assert.ok(w && w.titel, `Welle ${n} fehlt oder hat keinen Titel`);
    const summe = ['erledigt', 'teilweise', 'arbeit', 'frage', 'offen', 'entfaellt'].reduce((s, k) => s + w.zaehler[k], 0);
    assert.equal(summe, w.pakete.length);
  }
});

test('Statuswörter werden erkannt', () => {
  assert.equal(klasse('erledigt (PR 149)'), 'erledigt');
  assert.equal(klasse('erledigt bis auf den Einstieg-Text'), 'teilweise');
  assert.equal(klasse('Regel erledigt; Anzeige offen'), 'teilweise');
  assert.equal(klasse('in Arbeit (PR 200)'), 'arbeit');
  assert.equal(klasse('Ausfahrende Boote (aufgegangen in P66)'), 'entfaellt');
  assert.equal(klasse('offen, kommt mit P28'), null);
  assert.equal(klasse('neu'), null);
});

test('Einzelpunkte hängen an existierenden Paketen', () => {
  const ids = new Set(d.pakete.map((p) => p.id));
  assert.ok(d.punkte.length > 150);
  for (const x of d.punkte) for (const id of x.pakete) assert.ok(ids.has(id), `${x.code} verweist auf unbekanntes ${id}`);
});

test('README-Abschnitt wird ersetzt, nicht verdoppelt', () => {
  const a = readmeAbschnitt(d);
  const einmal = readmeEinsetzen('# T\n\n## Wegweiser\n', a);
  const zweimal = readmeEinsetzen(einmal, a);
  assert.equal(einmal, zweimal);
  assert.equal(zweimal.split('<!-- roadmap:start -->').length, 2);
});


test('Bilder der Roadmap: Datei vorhanden, Paket bekannt, nicht zu groß', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const { leseBilder } = await import('../tools/roadmap.mjs');
  const bilder = leseBilder();
  const ordner = new URL('../web/roadmap/bilder/', import.meta.url);
  const dateien = new Set(readdirSync(ordner));
  const mit = erzeuge(md, undefined, bilder);
  for (const b of mit.bilder) {
    assert.ok(dateien.has(b.datei), `${b.datei} fehlt in web/roadmap/bilder/`);
    assert.ok(statSync(new URL(b.datei, ordner)).size < 400_000, `${b.datei} ist größer als 400 KB`);
    assert.ok(b.pakete.length, `${b.datei} gehört zu keinem Paket`);
  }
});
