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
