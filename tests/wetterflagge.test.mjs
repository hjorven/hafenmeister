// Wetter an der Flagge: was der Mast bei welcher Vorhersage zeigt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeichen } from '../web/js/features/wetterflagge.js';

test('ruhiger Tag: kein Wimpel, keine Leine, Wind aus der Vorhersage', () => {
  const z = zeichen([{ day: 3, event: null, weather: { wind: 0.3 } }, { day: 4, event: null, weather: { wind: 0.2 } }]);
  assert.deepEqual(z, { wind: 0.3, sturmMorgen: false, regatta: false });
});

test('Sturm morgen: rote Wimpel', () => {
  const z = zeichen([{ event: null, weather: { wind: 0.5 } }, { event: { id: 'sturm' }, weather: { wind: 1 } }]);
  assert.equal(z.sturmMorgen, true);
});

test('Regatta heute oder morgen: Signalflaggen', () => {
  assert.equal(zeichen([{ event: { id: 'regatta' }, weather: {} }, { event: null }]).regatta, true);
  assert.equal(zeichen([{ event: null, weather: {} }, { event: { id: 'regatta' } }]).regatta, true);
});

test('ohne Vorhersage: leichter Wind, sonst nichts', () => {
  assert.deepEqual(zeichen(null), { wind: 0.2, sturmMorgen: false, regatta: false });
  assert.equal(zeichen([{ weather: { wind: 3 } }]).wind, 1);
});
