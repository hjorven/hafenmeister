// Tests für die Landschaft (web/js/render/landschaft/), ohne Browser und ohne Three.js.
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAFEN } from '../web/js/data/harbor.js';
import { punkt, warteplaetze, wegeNetz, molen, PLAN_M } from '../web/js/render/landschaft/gelaende.js';
import { REGIONEN, region } from '../web/js/render/landschaft/regionen.js';
import { uhrzeitAusSpielzeit } from '../web/js/render/landschaft/zeit.js';

const ostsee = region('ostsee');

test('es gibt genau die zwei Reviere Ostsee und Nordsee', () => {
  assert.deepEqual(Object.keys(REGIONEN).sort(), ['nordsee', 'ostsee']);
});

test('Gelände ist an jedem Liegeplatz so tief wie in den Hafendaten (Toleranz 0,4 m)', () => {
  let geprueft = 0;
  for (const p of HAFEN.plaetze) {
    for (const [stufe, lage] of Object.entries(p.lage)) {
      const soll = p.tiefe?.[stufe];
      if (soll == null) continue;
      const ist = -punkt(lage[0], lage[1], Number(stufe), ostsee).h;
      assert.ok(ist >= soll - 0.4, `${p.id} Stufe ${stufe}: Gelände ${ist.toFixed(2)} m, Hafendaten ${soll} m`);
      geprueft++;
    }
  }
  assert.ok(geprueft > 200, `nur ${geprueft} Plätze geprüft`);
});

test('Wartebojen und Ankerbereiche liegen in jedem Revier und jeder Stufe in tiefem Wasser', () => {
  for (const name of Object.keys(REGIONEN)) {
    const r = region(name);
    const ebbe = r.gelaende.gezeiten || 0;
    for (let stufe = 1; stufe <= 5; stufe++) {
      const { bojen, ankerbereiche } = warteplaetze(stufe);
      assert.ok(bojen.length >= 3, `Stufe ${stufe}: zu wenige Bojen`);
      for (const b of [...bojen, ...ankerbereiche]) {
        const tiefe = -punkt(b.px, b.py, stufe, r).h - ebbe;
        assert.ok(tiefe >= 1.5, `${name} Stufe ${stufe} ${b.id}: nur ${tiefe.toFixed(2)} m bei Niedrigwasser`);
        assert.equal(b.x, b.px * PLAN_M);
      }
    }
  }
});

test('Ab Stufe 3 warten Boote draußen vor der Einfahrt, vorher im Binnensee', () => {
  for (let stufe = 1; stufe <= 5; stufe++) {
    for (const b of warteplaetze(stufe).bojen) {
      const p = punkt(b.px, b.py, stufe, ostsee);
      if (stufe <= 2) assert.ok(p.see < 0.5, `Stufe ${stufe} ${b.id} sollte im See liegen`);
      else assert.ok(p.see > 0.5, `Stufe ${stufe} ${b.id} sollte auf See liegen`);
    }
  }
});

test('Wege liegen an Land, Molenwege über Wasser auf der Krone', () => {
  for (const name of Object.keys(REGIONEN)) {
    for (let stufe = 1; stufe <= 5; stufe++) {
      const wege = wegeNetz(stufe, region(name));
      assert.ok(wege.some((w) => w.typ === 'strasse'));
      if (stufe >= 3) assert.ok(wege.some((w) => w.typ === 'promenade'));
      assert.equal(wege.filter((w) => w.typ === 'mole').length, molen(stufe).length);
      for (const w of wege) for (const q of w.punkte) assert.ok(q.y > 0, `${name} ${w.id} liegt unter Wasser`);
    }
  }
});

test('Uhrzeit folgt der Spielzeit: 90 s Tag, 30 s Abend, dann wieder Morgen', () => {
  assert.equal(uhrzeitAusSpielzeit(0), 6.5);
  assert.equal(uhrzeitAusSpielzeit(90), 19);
  assert.ok(Math.abs(uhrzeitAusSpielzeit(120) - 6.5) < 1e-9);
  let vorher = -1;
  for (let s = 0; s < 120; s += 0.5) {
    const h = uhrzeitAusSpielzeit(s);
    assert.ok(h > vorher, `Uhrzeit springt zurück bei ${s} s`);
    vorher = h;
  }
});

test('Nordsee: Bauwerke liegen über dem höchsten Hochwasser', () => {
  const r = region('nordsee');
  const flut = r.gelaende.gezeiten;
  for (const [px, py] of [[0, -3], [100, -3], [70, 222]]) {
    const p = punkt(px, py, 5, r);
    assert.ok(p.h > flut, `Fläche bei ${px},${py} nur ${p.h.toFixed(2)} m`);
  }
});
