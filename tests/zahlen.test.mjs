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

test('Gemeinsamer Zufall: Spielregeln nutzen nie Math.random (nur random.js mit Startwert)', () => {
  const regeln = ['web/js/sim.js', 'web/js/services/rules.js', 'web/js/events/scheduler.js', 'web/js/features/stammgaeste.js',
    'web/js/features/dauerlieger.js', 'web/js/features/tagesziele.js'];
  for (const f of regeln) {
    const code = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/Math\.random/.test(code), `${f} nutzt Math.random`);
  }
});

test('Services-Abrechnung ohne eigenen Zufall fällt bei gleichem Tag gleich aus', async () => {
  const { erstelleRegeln, neuerZustand } = await import('../web/js/services/rules.js');
  const R = erstelleRegeln();
  const z = neuerZustand();
  R.bauen(z, 'raeucherei', { stufe: 2, ruf: 5, geld: 1e6 });
  const boote = Array.from({ length: 30 }, () => ({ klasse: 'M', antrieb: 'segel' }));
  const a = R.tagesabschluss(structuredClone(z), { tag: 5, boote });
  const b = R.tagesabschluss(structuredClone(z), { tag: 5, boote });
  assert.deepEqual(a, b);
});
