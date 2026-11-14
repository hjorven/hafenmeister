// Meldungs-Ordnung (web/js/ui/meldungen.js): höchstens eine schwebende Meldung zugleich, wichtigere zuerst.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waehle, VORRANG, init } from '../web/js/ui/meldungen.js';

test('höchster Vorrang gewinnt, bei Gleichstand der ältere Wunsch', () => {
  assert.equal(waehle([]), null);
  assert.equal(waehle([{ id: 'tipp', vorrang: VORRANG.tipp, seit: 1 }, { id: 'zettel', vorrang: VORRANG.zettel, seit: 2 }]), 'zettel');
  assert.equal(waehle([{ id: 'a', vorrang: 50, seit: 2 }, { id: 'b', vorrang: 50, seit: 1 }]), 'b');
});

test('Reihenfolge: Feier, Kartenwahl, Karte, Zettel, wartender Dauerlieger, Einstieg, Tipp, andere Dauerplatz-Meldungen', () => {
  const r = ['feier', 'kartenwahl', 'abschluss', 'zettel', 'dauerWartet', 'einstieg', 'tipp', 'dauer'].map((k) => VORRANG[k]);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1] > r[i], `${i}`);
});

test('wunsch, darf, fertig: der Tipp wartet, bis der Zettel weg ist', () => {
  const game = {};
  init(game);
  const m = game.meldungen;
  m.wunsch('einstieg', VORRANG.tipp);
  assert.equal(m.darf('einstieg'), true);
  m.wunsch('zettel', VORRANG.zettel);
  assert.equal(m.darf('einstieg'), false);
  assert.equal(m.darf('zettel'), true);
  m.fertig('zettel');
  assert.equal(m.darf('einstieg'), true);
  // Der Tipp geht einer Dauerplatz-Meldung vor, ein wartender Dauerlieger mit Frist dem Tipp
  m.wunsch('dauer', VORRANG.dauer);
  assert.equal(m.darf('einstieg'), true);
  m.wunsch('dauer', VORRANG.dauerWartet);
  assert.equal(m.darf('dauer'), true);
  m.fertig('dauer');
  m.fertig('einstieg');
  assert.equal(m.stand().steht, null);
});
