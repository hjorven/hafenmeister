// Revierdaten Ostsee und Nordsee (web/js/data/regions.js, docs/regionen.md). Früher tools/test-regionen.mjs,
// das im normalen Testlauf nicht lief (Roadmap, Befund zu P57). Die Gezeiten prüft tests/gezeiten.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIERE, REVIER_REIHENFOLGE } from '../web/js/data/regions.js';
import { istFrei } from '../web/js/world/region.js';

const farbe = /^#[0-9a-f]{6}$/i;
const pflicht = ['id', 'name', 'hafenname', 'vorbilder', 'freischalten', 'kueste', 'farben', 'licht', 'bauweise', 'natur', 'wasser', 'musik'];

test('Reviere: Pflichtfelder, Farben, Reihenfolge', () => {
  assert.deepEqual(Object.keys(REVIERE), ['ostsee', 'nordsee'], 'nur zwei Reviere (Entscheidung Jorven, 11.11.2026)');
  assert.deepEqual(Object.keys(REVIERE).sort(), [...REVIER_REIHENFOLGE].sort());
  for (const [id, r] of Object.entries(REVIERE)) {
    for (const f of pflicht) assert.ok(r[f] !== undefined, `${id}: Feld ${f} fehlt`);
    assert.equal(r.id, id);
    for (const [k, v] of Object.entries(r.farben)) assert.match(v, farbe, `${id}: farben.${k}`);
    for (const ph of ['tag', 'abend']) {
      for (const k of ['himmel', 'boden', 'sonne']) assert.match(r.licht[ph][k], farbe, `${id}: licht.${ph}.${k}`);
      assert.ok(r.licht[ph].staerke > 0);
    }
    for (const c of [...r.bauweise.waende, ...r.bauweise.daecher, r.bauweise.holz, r.bauweise.akzent, r.bauweise.fensterAbend]) assert.match(c, farbe);
  }
  assert.equal(REVIERE.ostsee.wasser.tide, null, 'Ostsee ohne Tide');
  assert.ok(REVIERE.nordsee.wasser.tide, 'Nordsee mit Tide');
});

test('Freischalten: Ostsee von Anfang an, Nordsee ab Ostsee Stufe 5', () => {
  assert.equal(REVIERE[REVIER_REIHENFOLGE[0]].freischalten.start, true);
  assert.equal(istFrei(REVIERE.ostsee, {}), true);
  assert.equal(istFrei(REVIERE.nordsee, { ostsee: 4 }), false);
  assert.equal(istFrei(REVIERE.nordsee, { ostsee: 5 }), true);
});

test('Küsten je Revier: die Nordsee hat ihre eigene Auswahl, jede mit Platz für Trockenfallplätze (P57 Teil 6)', async () => {
  const { TYPEN } = await import('../web/js/render/landschaft/natur.js');
  const { formSetzen } = await import('../web/js/render/landschaft/formen.js');
  const { bojenfeldLage } = await import('../web/js/render/landschaft/bojenfeld-lage.js');
  const { formenFuer } = await import('../web/js/save/save-panel.js');
  assert.equal(REVIERE.ostsee.kuesten, null, 'Ostsee: alle Küsten wie bisher');
  const nr = REVIERE.nordsee.kuesten;
  assert.ok(Array.isArray(nr) && nr.length >= 3);
  for (const k of nr) assert.ok(TYPEN.some((t) => t.nr === k), `Küste ${k} gibt es`);
  assert.deepEqual(formenFuer('nordsee').map((f) => f.nr), TYPEN.filter((t) => nr.includes(t.nr)).map((t) => t.nr));
  assert.equal(formenFuer('ostsee').length, TYPEN.length);
  for (const k of nr) {
    for (const seed of [1, 2, 3]) {
      formSetzen(k, seed);
      assert.ok(bojenfeldLage('nordsee').length >= 6, `Küste ${k}, Seed ${seed}: mindestens ein Bauabschnitt Trockenfallplätze`);
    }
  }
  formSetzen(1, 1);
});
