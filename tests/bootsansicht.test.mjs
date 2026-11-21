// Bootsansicht (render/boat-view.js) ohne Browser: Boote im Wasser gegen ein nachgebautes game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootsansicht } from './bootsansicht-stub.mjs';

const SEEZUGANG = { seezugaenge: () => [{ x: -900, z: -700, grad: 0, weg: [{ x: -900, z: -700 }, { x: -600, z: -500 }, { x: -200, z: -150 }] }] };

test('Stufenaufstieg: ein Boot in der Anfahrt von See fährt weiter und bleibt antippbar', () => {
  const { game, boote, log, laufe, boot } = bootsansicht({ stufe: 2, extra: { gelaende: SEEZUGANG } });
  game.emit('ready');
  const info = { id: 7, groesse: 'M', art: 'motor', modell: 'x', palette: 0, name: 'Test', boje: 1 };
  boote.push(info);
  game.emit('boot-kommt', info);
  laufe(10);
  const a = boot(7);
  assert.equal(a.moored, false, 'Vorbedingung: das Boot ist noch unterwegs');
  assert.ok(a.task || a.tasks.length, 'Vorbedingung: das Boot hat noch Fahraufgaben');
  const vorher = { x: a.x, z: a.z };

  game.state.stage = 3;
  game.emit('stufe', 3);
  assert.equal(a.moored, false, 'das Boot springt beim Aufstieg nicht an die Boje');
  assert.ok(Math.hypot(a.x - vorher.x, a.z - vorher.z) < 1, 'das Boot bleibt, wo es gerade fährt');
  assert.ok(!log.some((l) => l.name === 'boot:an-boje'), 'noch nicht an der Boje gemeldet');

  // Es fährt zu Ende, macht an der Boje fest und lässt sich danach antippen
  for (let i = 0; i < 90 && !a.moored; i++) laufe(10);
  assert.equal(a.moored, true, 'das Boot kommt an der Boje an');
  assert.ok(a.model.userData.pick, 'an der Boje ist das Boot antippbar');
  assert.ok(log.some((l) => l.name === 'boot:an-boje' && l.id === 7));
});

test('Laden: ein hart an die Boje gesetztes Boot ist antippbar', () => {
  const { game, boote, laufe, boot } = bootsansicht({ stufe: 2, extra: { gelaende: SEEZUGANG } });
  game.emit('ready');
  const info = { id: 7, groesse: 'M', art: 'motor', modell: 'x', palette: 0, name: 'Test', boje: 1 };
  boote.push(info);
  game.emit('boot-kommt', info);
  laufe(10);
  game.emit('sim:change', { reason: 'load' });
  const a = boot(7);
  assert.equal(a.moored, true, 'nach dem Laden liegt das Boot an der Boje');
  assert.ok(a.model.userData.pick, 'und lässt sich antippen');
});
