// Leinen annehmen (P48, docs/leinen.md): reine Regeln aus web/js/features/leinen.js und die Zahlen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY } from '../web/js/data/economy.js';
import { leinenTrinkgeld, leinenPlatz, gastFuerPlatz, leinenTon, LEINE_RASTER } from '../web/js/features/leinen.js';
import { FARBE } from '../web/js/ui/pixel-symbole.js';

test('Zahlen stehen in ECONOMY.leinen', () => {
  const e = ECONOMY.leinen;
  assert.ok(e, 'ECONOMY.leinen fehlt (oben in ECONOMY, nicht in einem anderen Block)');
  for (const k of ['S', 'M', 'L', 'XL', 'XXL']) assert.ok(e.trinkgeld[k] > 0, `Trinkgeld für ${k}`);
  assert.ok(e.abstandM > 10 && e.gleichzeitig >= 1 && e.warteSek > 0 && e.warteSek < 5 && e.warteBisTempo >= 1);
});

test('Trinkgeld wächst mit der Bootsklasse und bleibt klein gegen das Liegegeld', () => {
  const k = ['S', 'M', 'L', 'XL', 'XXL'].map((g) => leinenTrinkgeld(g));
  for (let i = 1; i < k.length; i++) assert.ok(k[i] >= k[i - 1], `${k}`);
  // höchstens rund ein Zehntel einer Nacht (Grundpreis plus Meter, kleinste Länge der Klasse)
  for (const g of ['S', 'M', 'L', 'XL']) {
    const p = ECONOMY.klassen[g];
    assert.ok(leinenTrinkgeld(g) <= Math.max(2, (p.grundpreis + p.proMeter * 4) * 0.15), `${g} ${leinenTrinkgeld(g)}`);
  }
  assert.equal(leinenTrinkgeld('Q'), 0);
  assert.equal(leinenTrinkgeld(undefined), 0);
  assert.equal(leinenTrinkgeld('S', { trinkgeld: { S: 2.4 } }), 2);
});

test('Leinen nur am Steg, Kai oder Pier, nie an Boje, Anker, Bojenfeld oder im Päckchen', () => {
  assert.equal(leinenPlatz({ id: 'A01', kind: 'box' }), true);
  assert.equal(leinenPlatz({ id: 'K02', kind: 'kai' }), true);
  assert.equal(leinenPlatz({ id: 'F03', kind: 'finger' }), true);
  assert.equal(leinenPlatz({ id: 'boje-0', kind: 'box' }), false);
  assert.equal(leinenPlatz({ id: 'anker-3', kind: 'buoy' }), false);
  assert.equal(leinenPlatz({ id: 'X', kind: 'buoy' }), false);
  assert.equal(leinenPlatz({ id: 'BF04', kind: 'box' }), false);
  assert.equal(leinenPlatz({ id: 'A01~2', kind: 'paeckchen' }), false);
  assert.equal(leinenPlatz({ id: 'A01~2', kind: 'kai', paeckchen: true }), false);
  assert.equal(leinenPlatz(null), false);
  assert.equal(leinenPlatz({ kind: 'box' }), false);
});

test('Nur Gäste, die gerade an diesen Platz fahren', () => {
  assert.equal(gastFuerPlatz({ berthId: 'A01' }, 'A01'), true);
  assert.equal(gastFuerPlatz({ berthId: 'A01+A02' }, 'A01'), true);    // Doppelbox
  assert.equal(gastFuerPlatz({ berthId: 'A02' }, 'A01'), false);
  assert.equal(gastFuerPlatz({ berthId: null }, 'A01'), false);
  assert.equal(gastFuerPlatz(undefined, 'A01'), false);
});

test('Töne steigen je Leine und bleiben im Bereich des Münzklangs', () => {
  assert.deepEqual([1, 2, 3, 4].map(leinenTon), [1, 2, 3, 4]);
  assert.equal(leinenTon(0), 1);
  assert.equal(leinenTon(40), 10);
});

test('Tau-Symbol ist ein 12 x 12 Raster mit Farben aus pixel-symbole.js', () => {
  assert.equal(LEINE_RASTER.length, 12);
  for (const z of LEINE_RASTER) {
    assert.equal(z.length, 12);
    for (const c of z) assert.ok(c === '.' || FARBE[c], `Farbe ${c}`);
  }
});
