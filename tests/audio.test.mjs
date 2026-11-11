// Prüft das Ton-Modul ohne Browser: alle Klänge haben einen Erzeuger, und ohne
// Web Audio (z.B. Node oder sehr alte Browser) passiert nichts Schlimmes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audio, SOUNDS, init } from '../web/js/audio/audio.js';

test('jeder Klang hat einen Erzeuger', () => {
  for (const name of Object.keys(SOUNDS)) {
    assert.equal(typeof audio._sfx[name], 'function', `Erzeuger fehlt: ${name}`);
    assert.ok(SOUNDS[name].label, `Beschriftung fehlt: ${name}`);
  }
  for (const name of Object.keys(audio._sfx)) assert.ok(SOUNDS[name], `nicht in SOUNDS: ${name}`);
});

test('ohne Web Audio bleibt alles still und wirft nicht', () => {
  assert.equal(audio.supported, false);
  assert.equal(audio.ready, false);
  assert.equal(audio.play('muenze'), false);
  assert.equal(audio.sfx('muenze', { combo: 3 }), false);
  assert.equal(audio.horn('XL'), false);
  audio.setPhase('abend');
  audio.setWeather('sturm');
  audio.setHarbor({ stufe: 3, boote: 10 });
  assert.equal(audio.state.phase, 'abend');
  assert.equal(audio.state.wetter, 'sturm');
  assert.equal(audio.state.stufe, 3);
  assert.equal(typeof init, 'function');
});

test('Lautstärke wird begrenzt', () => {
  audio.setVolume('musik', 2);
  assert.equal(audio.getVolume('musik'), 1);
  audio.setVolume('effekte', -1);
  assert.equal(audio.getVolume('effekte'), 0);
  audio.setVolume('gibtsnicht', 0.5);
  assert.equal(audio.getVolume('gibtsnicht'), undefined);
});
