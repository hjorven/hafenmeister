// Ereignisse des Spielobjekts (web/js/core/ereignisse.js): ein Fehler in einem Zuhörer darf die
// anderen nicht aufhalten. Fund aus CI (tablet-quer, 13.11.): nach dem Kassieren stieg das Geld,
// aber die Geldanzeige oben blieb bei "0 €", weil die Kette vor 'sim:change' abbrach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmitter } from '../web/js/core/ereignisse.js';

test('Wirft ein Zuhörer, bekommen die anderen das Ereignis trotzdem', () => {
  const gemeldet = [];
  const ev = createEmitter({ melde: (name, err) => gemeldet.push([name, err.message]) });
  const bekommen = [];
  ev.on('sim:collected', () => { throw new Error('kaputt'); });
  ev.on('sim:collected', (d) => bekommen.push(d.amount));
  ev.emit('sim:collected', { amount: 22 });
  assert.deepEqual(bekommen, [22]);
  assert.deepEqual(gemeldet, [['sim:collected', 'kaputt']], 'der Fehler wird gemeldet, nicht verschluckt');
});

test('Wie bridge.js: ein Fehler bei sim:collected hält sim:change (Geldanzeige) nicht auf', () => {
  const ev = createEmitter({ melde: () => {} });
  let anzeige = '0 €';
  const state = { money: 0 };
  ev.on('sim:collected', () => { throw new Error('Grafik'); });
  ev.on('sim:change', () => { anzeige = `${state.money} €`; });
  // dispatch() in bridge.js: erst jedes Ereignis, dann sim:change
  const dispatch = (events) => { for (const e of events) ev.emit(`sim:${e.type}`, e); ev.emit('sim:change', { events }); };
  state.money += 22;
  dispatch([{ type: 'collected', boatId: 1, amount: 22 }]);
  assert.equal(anzeige, '22 €');
});

test('Abmelden und Ereignisse ohne Zuhörer', () => {
  const ev = createEmitter();
  let n = 0;
  const ab = ev.on('x', () => n++);
  ev.emit('x');
  ab();
  ev.emit('x');
  ev.emit('niemand-hoert', 1);
  assert.equal(n, 1);
});
