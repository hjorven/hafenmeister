// Ein ganzer Spieltag mit festem Startwert, echtem Hafen und echten Zahlen (Roadmap O3).
// Alle 5 Sekunden wird verteilt, was wartet (wie das Hafenbüro), abends wird kassiert. Geprüft wird, dass der Tag
// vollständig und stimmig abläuft und mit demselben Startwert genau gleich wieder abläuft.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize } from '../web/js/state.js';
import * as sim from '../web/js/sim.js';
import { RULES, ECONOMY, echterHafen } from './regeln.mjs';

const ctx = echterHafen();

function spieleTag(seed, stufe = 1) {
  const s = createState({ seed });
  s.stage = stufe;
  for (const p of RULES.jettyProjects.filter((j) => j.stage <= stufe)) s.buildings[p.id] = 1;
  const alle = [];
  const ende = RULES.dayLength + RULES.eveningLength;
  for (let t = 0; t < ende; t += 5) {
    alle.push(...sim.tick(s, ctx, 5));
    alle.push(...sim.autoAssign(s, ctx));
    if (s.phase === 'evening') alle.push(...sim.collectAll(s, ctx, true));
  }
  return { s, alle };
}

test('Spieltag Stufe 1: Boote kommen, legen an, zahlen, der nächste Morgen beginnt', () => {
  const { s, alle } = spieleTag(42, 1);
  const arten = (typ) => alle.filter((e) => e.type === typ);
  assert.equal(s.day, 2, 'nach Tag und Abend beginnt Tag 2');
  assert.ok(arten('arrived').length >= 1, 'es kommen Boote');
  assert.ok(arten('moored').length >= 1, 'mindestens ein Boot legt an');
  assert.ok(s.money > 0, `Kasse ${s.money}`);
  // Jedes Boot an einem Platz steht auch so im Hafen
  for (const [platz, boot] of Object.entries(s.berths)) assert.equal(s.boats[boot].berthId, platz);
  // Liegegeld je Boot nie über dem höchsten möglichen Betrag
  const hoechstens = Math.max(...Object.values(RULES.baseFee)) * (1 + RULES.wishBonus * 3);
  for (const e of arten('feeReady')) assert.ok(e.amount > 0 && e.amount <= hoechstens, `Liegegeld ${e.amount}`);
});

test('Spieltag mit festem Startwert läuft genau gleich ab', () => {
  for (const stufe of [1, 3, 6]) {
    const a = spieleTag(7, stufe);
    const b = spieleTag(7, stufe);
    assert.equal(serialize(a.s), serialize(b.s), `Stufe ${stufe}`);
    assert.deepEqual(a.alle.map((e) => e.type), b.alle.map((e) => e.type));
  }
});

test('Spieltag Stufe 6: Ankünfte passen zu den Zahlen in economy.js', () => {
  const { alle } = spieleTag(3, 6);
  const neu = alle.filter((e) => e.type === 'arrived').length;
  const soll = ECONOMY.stufen.find((x) => x.stufe === 6).ankuenfte;
  // Ruf 3 zum Start: Faktor 1, Zufall um die Erwartung herum
  assert.ok(neu >= soll * 0.4 && neu <= soll * 1.6, `${neu} Ankünfte, erwartet etwa ${soll}`);
});

test('Keine Wellen: in jeder Stufe, bei Ruf 5 und an Regattatagen mindestens der Mindestabstand', () => {
  const gap = RULES.arrivalMinGap;
  assert.ok(gap >= 3);
  for (const faktor of [1, 1.6]) {
    const c = echterHafen();
    if (faktor !== 1) sim.addHook(c, 'modifiers', () => ({ arrivalFactor: faktor }));
    for (let stufe = 1; stufe <= RULES.maxStage; stufe++) {
      for (let seed = 1; seed <= 10; seed++) {
        const s = createState({ seed });
        s.stage = stufe;
        s.ratings = Array(RULES.reputation.window).fill(5);
        s.day = 2;
        sim.tick(s, c, 0);
        const t = s.upcoming.map((b) => b.arriveAt);
        for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= gap - 0.05, `Stufe ${stufe}, Faktor ${faktor}: ${t[i - 1]} -> ${t[i]}`);
      }
    }
  }
});

test('Erster Tag: erstes Boot gleich, die übrigen mit ruhigem Abstand und ohne Gruppe', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = createState({ seed });
    sim.tick(s, ctx, 0);
    const t = s.upcoming.map((b) => b.arriveAt);
    assert.equal(t[0], RULES.firstArrivalAt);
    if (t.length > 1) assert.ok(t[1] - t[0] >= 5 * RULES.arrivalMinGap - 0.05, `zweites Boot zu früh: ${t}`);
    for (let i = 2; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= RULES.arrivalMinGap - 0.05, `Gruppe: ${t}`);
  }
});
