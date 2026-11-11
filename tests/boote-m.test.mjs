// Tests für die Schiffe der Größe M (web/js/data/boats/m.js) gegen die Liegeplätze (web/js/data/harbor.js).
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MODELS } from '../web/js/data/boats/m.js';
import { HAFEN } from '../web/js/data/harbor.js';

// Regel aus docs/hafen-und-schiffe.md, Abschnitt 2: nicht länger, nicht breiter, Wassertiefe >= Tiefgang + 0,3 m
function passt(boot, platz, stufe) {
  const tiefe = platz.tiefe?.[stufe];
  return platz.stufen.includes(stufe) &&
    boot.length <= platz.maxLaenge && boot.beam <= platz.maxBreite &&
    tiefe !== undefined && tiefe >= boot.draft + 0.3;
}

test('vier Arten mit je fünf Modellen, Kennungen eindeutig', () => {
  assert.equal(TYPES.length, 4);
  assert.equal(MODELS.length, 20);
  assert.equal(new Set(MODELS.map((m) => m.id)).size, 20);
  for (const t of TYPES) assert.equal(MODELS.filter((m) => m.typeId === t.id).length, 5, t.id);
});

test('Maße liegen in den Spannen der Art', () => {
  for (const m of MODELS) {
    const t = TYPES.find((tt) => tt.id === m.typeId);
    for (const k of ['length', 'beam', 'draft']) {
      assert.ok(m[k] >= t[k][0] && m[k] <= t[k][1], `${m.id} ${k}=${m[k]} nicht in ${t[k]}`);
    }
    assert.ok(m.fromStage >= t.fromStage, `${m.id} kommt vor seiner Art`);
    assert.ok(m.palettes.length >= 2, `${m.id} braucht mindestens zwei Farbvarianten`);
  }
});

test('jedes Modell findet ab seiner Stufe einen passenden Liegeplatz', () => {
  for (const m of MODELS) {
    const art = m.mooring === 'fischer' ? ['fischer'] : ['box', 'finger', 'stirn'];
    const plaetze = HAFEN.plaetze.filter((p) => art.includes(p.art) && passt(m, p, m.fromStage));
    assert.ok(plaetze.length > 0, `${m.id} (${m.name}) hat in Stufe ${m.fromStage} keinen Platz`);
  }
});
