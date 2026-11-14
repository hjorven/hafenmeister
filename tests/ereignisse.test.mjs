// Tests für den Ereignis-Planer. Aufruf: node --test tests/ereignisse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, seasonOf } from '../web/js/events/scheduler.js';
import { EVENTS, DEFAULT_MODS } from '../web/js/data/events.js';

function run(seed, days, ctx) {
  const s = createScheduler({ seed });
  const log = [];
  for (let d = 1; d <= days; d++) {
    const c = typeof ctx === 'function' ? ctx(d) : ctx;
    for (const ch of s.advanceTo(d, c)) log.push(ch);
  }
  return { s, log };
}

test('Jahreslauf: 30 Tage Saison, 3 Tage Winter', () => {
  assert.equal(seasonOf(1).part, 'fruehling');
  assert.equal(seasonOf(15).part, 'sommer');
  assert.equal(seasonOf(30).part, 'herbst');
  assert.equal(seasonOf(31).winter, true);
  assert.equal(seasonOf(33).winterDay, 3);
  assert.deepEqual([seasonOf(34).year, seasonOf(34).seasonDay], [2, 1]);
});

test('ohne Ereignis gelten die Standardwerte', () => {
  const s = createScheduler({ seed: 1 });
  s.advanceTo(1, { stage: 1 });
  assert.deepEqual(s.modifiers(), { ...DEFAULT_MODS, sizeFactor: { ...DEFAULT_MODS.sizeFactor }, kindFactor: {}, satisfaction: { ...DEFAULT_MODS.satisfaction } });
});

test('jedes Ereignis wird vorher angekündigt, nie zwei gleichzeitig, nie im Winter', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { log } = run(seed, 330, { stage: 6, buildings: { segelclub: 1, raeucherei: 1 } });
    const announced = new Map();
    let active = null;
    for (const c of log) {
      if (c.type === 'announce') {
        assert.ok(c.startDay > c.day, 'Ankündigung vor dem Start');
        // höchstens eine kleine und eine große Ankündigung (Hanse-Woche, zehn Tage vorher) offen
        assert.equal([...announced.values()].filter((a) => !!a.event.gross === !!c.event.gross).length, 0, 'nur eine Ankündigung je Art offen');
        announced.set(c.event.id, c);
      }
      if (c.type === 'start') {
        assert.equal(active, null, 'nie zwei Ereignisse gleichzeitig');
        const a = announced.get(c.event.id);
        assert.ok(a && a.startDay === c.day, 'Start wie angekündigt');
        announced.delete(c.event.id);
        for (let d = c.day; d <= c.endDay; d++) assert.equal(seasonOf(d).winter, false, 'nicht im Winter');
        active = c;
      }
      if (c.type === 'end') { assert.equal(active?.event.id, c.event.id); active = null; }
    }
  }
});

test('Stufen und Bauwerke schalten Ereignisse frei', () => {
  const { log } = run(7, 200, { stage: 2, buildings: {} });
  const ids = new Set(log.filter((c) => c.type === 'start').map((c) => c.event.id));
  assert.ok(!ids.has('sturm') && !ids.has('regatta') && !ids.has('hafenfest'));
  assert.ok(ids.has('nebel') || ids.has('sommertag'));

  const r3 = run(7, 200, { stage: 3, buildings: {} });
  const ids3 = new Set(r3.log.filter((c) => c.type === 'start').map((c) => c.event.id));
  assert.ok(ids3.has('sturm'));
  assert.ok(!ids3.has('regatta'), 'Regatta erst mit Segelclub');

  const r3b = run(7, 200, { stage: 3, buildings: { segelclub: 1 } });
  assert.ok(r3b.log.some((c) => c.type === 'start' && c.event.id === 'regatta'));
});

test('Häufigkeit: alle Ereignisse kommen vor, keins dominiert', () => {
  const count = {};
  for (let seed = 1; seed <= 20; seed++) {
    const { log } = run(seed, 330, { stage: 6, buildings: { segelclub: 1, raeucherei: 1 } });
    for (const c of log) if (c.type === 'start') count[c.event.id] = (count[c.event.id] ?? 0) + 1;
  }
  for (const def of EVENTS) assert.ok((count[def.id] ?? 0) > 0, `${def.id} kommt vor`);
  const perSeason = Object.values(count).reduce((a, b) => a + b, 0) / 20 / 10;
  assert.ok(perSeason >= 4 && perSeason <= 10, `Ereignisse pro Saison: ${perSeason}`);
});

test('Sturm: Seenotretter-Station mindert die Folgen', () => {
  const find = (buildings) => {
    const s = createScheduler({ seed: 3 });
    for (let d = 1; d < 400; d++) {
      s.advanceTo(d, { stage: 3, buildings });
      if (s.current?.id === 'sturm') return s.modifiers();
    }
    throw new Error('kein Sturm');
  };
  const ohne = find({});
  assert.equal(ohne.seaArrivals, false);
  assert.equal(ohne.extraNights, 1);
  assert.equal(ohne.satisfaction.outer, -1);
  assert.equal(find({ seenotretter: 1 }).satisfaction.outer, -0.5);
  assert.equal(find({ seenotretter: 2 }).satisfaction.outer, 0);
});

test('Winter liefert Wintermodifikatoren und Schnee', () => {
  const s = createScheduler({ seed: 1 });
  s.advanceTo(31, { stage: 1 });
  assert.equal(s.modifiers().winter, true);
  assert.ok(s.modifiers().arrivalFactor < 0.5);
  assert.equal(s.weather(31).snow, 1);
});

test('Speichern und Laden ergibt denselben Verlauf', () => {
  const ctx = { stage: 4, buildings: { segelclub: 1 } };
  const a = createScheduler({ seed: 99 });
  for (let d = 1; d <= 40; d++) a.advanceTo(d, ctx);
  const b = createScheduler({ seed: 5 });
  b.load(JSON.parse(JSON.stringify(a.save())));
  for (let d = 41; d <= 120; d++) {
    const ca = a.advanceTo(d, ctx).map((c) => `${c.type}:${c.event.id}`);
    const cb = b.advanceTo(d, ctx).map((c) => `${c.type}:${c.event.id}`);
    assert.deepEqual(cb, ca, `Tag ${d}`);
  }
});

test('Wetterbericht zeigt angekündigte Ereignisse', () => {
  const s = createScheduler({ seed: 11 });
  for (let d = 1; d < 200; d++) {
    const ch = s.advanceTo(d, { stage: 3 });
    const ann = ch.find((c) => c.type === 'announce');
    if (ann) {
      const fc = s.forecast(3);
      assert.equal(fc.find((e) => e.day === ann.startDay)?.event?.id, ann.event.id);
      return;
    }
  }
  assert.fail('keine Ankündigung');
});

// ---------------------------------------------------------------- P24 Teil 2: Nachspiel, feste Tage, große Ereignisse

test('Nachspiel: nach dem Sturm einen Tag mehr Boote, mit Bonus nur wenn vorbereitet', () => {
  const s = createScheduler({ seed: 3 });
  let tag = 0;
  for (let d = 1; d < 400 && !tag; d++) {
    const ch = s.advanceTo(d, { stage: 3, buildings: {} });
    if (ch.some((c) => c.type === 'nachspiel' && c.event.id === 'sturm')) tag = d;
  }
  assert.ok(tag > 0, 'Nachspiel kommt');
  assert.equal(s.current, null);
  assert.equal(s.nachspiel?.id, 'sturm');
  assert.equal(s.modifiers().arrivalFactor, 1.4);
  assert.equal(s.modifiers().ratingBonus, 0);
  assert.equal(s.modifiers({ vorbereitet: (id) => id === 'sturm' }).ratingBonus, 0.15);
  s.advanceTo(tag + 1, { stage: 3 });
  assert.equal(s.nachspiel, null, 'nach einem Tag vorbei');
  assert.equal(s.modifiers().arrivalFactor, 1);
});

test('Mittsommer kommt jedes Jahr genau am Saisontag 14, Heringstage mit Räucherei am Tag 5', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { log } = run(seed, 33 * 5, { stage: 6, buildings: { segelclub: 1, raeucherei: 1 } });
    const ms = log.filter((c) => c.type === 'start' && c.event.id === 'mittsommer');
    assert.equal(ms.length, 5, `Mittsommer jedes Jahr (Samen ${seed})`);
    for (const c of ms) assert.equal(seasonOf(c.day).seasonDay, 14);
    const hering = log.filter((c) => c.type === 'start' && c.event.id === 'heringstage');
    assert.ok(hering.length >= 4, `Heringstage fast jedes Jahr (Samen ${seed}: ${hering.length})`);
    for (const c of hering) assert.equal(seasonOf(c.day).seasonDay, 5);
  }
  const ohne = run(1, 33 * 3, { stage: 6, buildings: { segelclub: 1 } });
  assert.ok(!ohne.log.some((c) => c.event?.id === 'heringstage'), 'Heringstage nur mit Räucherei');
});

test('Hanse-Woche: ab Stufe 5, zehn Tage vorher angekündigt, die anderen halten Abstand', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { s, log } = run(seed, 33 * 4, { stage: 5, buildings: { segelclub: 1 } });
    const ann = log.filter((c) => c.type === 'announce' && c.event.id === 'hansewoche');
    const starts = log.filter((c) => c.type === 'start' && c.event.id === 'hansewoche');
    assert.ok(starts.length >= 3, `Hanse-Woche fast jedes Jahr (Samen ${seed})`);
    for (const a of ann) assert.equal(a.startDay - a.day, 10, 'zehn Tage vorher');
    // Kein anderes Ereignis in der Hanse-Woche oder direkt davor/danach
    for (const h of starts) {
      for (const c of log.filter((x) => x.type === 'start' && x.event.id !== 'hansewoche')) {
        const ende = c.endDay;
        assert.ok(ende + 2 < h.day || c.day > h.endDay + 2, `${c.event.id} an Tag ${c.day} zu nah an der Hanse-Woche ${h.day}`);
      }
    }
    assert.ok(s.save().gross === null || typeof s.save().gross === 'object');
  }
  const r4 = run(1, 33 * 3, { stage: 4, buildings: { segelclub: 1 } });
  assert.ok(!r4.log.some((c) => c.event?.id === 'hansewoche'), 'erst ab Stufe 5');
});

test('Planer speichert großes Ereignis und Nachspiel und lädt alte Stände ohne sie', () => {
  const s = createScheduler({ seed: 5 });
  let d = 1;
  for (; d < 200 && !s.gross; d++) s.advanceTo(d, { stage: 6, buildings: {} });
  assert.ok(s.gross, 'Hanse-Woche angekündigt');
  const t = createScheduler({ seed: 99 });
  t.load(s.save());
  assert.deepEqual(t.gross, s.gross);
  const alt = s.save();
  delete alt.gross; delete alt.nachspiel;
  const u = createScheduler({ seed: 1 });
  u.load(alt);
  assert.equal(u.gross, null);
  assert.equal(u.nachspiel, null);
  u.advanceTo(d + 3, { stage: 6 });
});
