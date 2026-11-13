// Bezahlt-Wimpel: wann er am Bug weht (web/js/render/wimpel-regel.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wimpelAn } from '../web/js/render/wimpel-regel.js';

const box = { fest: true };

test('Gast in der Box: Wimpel genau dann, wenn bezahlt', () => {
  assert.equal(wimpelAn({ ...box, imSpiel: true, bezahlt: true }), true);
  assert.equal(wimpelAn({ ...box, imSpiel: true, bezahlt: false }), false);
});

test('nachts abgerechnet, liegt bis zum Ablegen am Vormittag noch in der Box: Wimpel bleibt', () => {
  assert.equal(wimpelAn({ ...box, imSpiel: false, abgerechnet: true }), true);
  // auch waehrend des Ablegens aus der Box
  assert.equal(wimpelAn({ legtAb: true, imSpiel: false, abgerechnet: true }), true);
});

test('nach dem Ablegen (boot-faehrt) ist der Wimpel weg', () => {
  assert.equal(wimpelAn({ ...box, imSpiel: false, abgerechnet: true, faehrt: true }), false);
});

test('weder in den Spielregeln noch abgerechnet: kein Wimpel', () => {
  assert.equal(wimpelAn({ ...box, imSpiel: false }), false);
});

test('Dauerlieger, Boje und unterwegs: nie ein Wimpel', () => {
  assert.equal(wimpelAn({ ...box, imSpiel: true, bezahlt: true, dauerlieger: true }), false);
  assert.equal(wimpelAn({ ...box, imSpiel: true, bezahlt: true, anBoje: true }), false);
  assert.equal(wimpelAn({ imSpiel: true, bezahlt: true }), false);
});
