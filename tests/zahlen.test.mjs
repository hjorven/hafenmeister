// Eine Quelle für alle Zahlen (Roadmap P06): Prüfwerkzeug und Zahlenübersicht.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pruefeZahlen, tabellen, ZAHLEN_DATEI } from '../tools/zahlen.mjs';

test('Spielzahlen: keine ungelesenen Felder, keine Ja/Nein statt Zahl, jede Ausbaustufe teurer', () => {
  assert.deepEqual(pruefeZahlen(), []);
});

test('docs/zahlen.md ist aus den aktuellen Zahlen erzeugt', () => {
  const datei = fs.readFileSync(ZAHLEN_DATEI, 'utf8');
  assert.equal(datei, tabellen() + '\n', 'veraltet: node tools/zahlen.mjs --schreiben');
});
