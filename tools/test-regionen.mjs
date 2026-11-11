// Prueft die Revierdaten und die Gezeitenrechnung ohne Browser.
// Aufruf: node tools/test-regionen.mjs
import assert from 'node:assert/strict';
import { REVIERE, REVIER_REIHENFOLGE } from '../web/js/data/regions.js';
import { wasserstand, pegel, passt, naechstesFenster, istFrei } from '../web/js/world/region.js';

const farbe = /^#[0-9a-f]{6}$/i;
const arten = new Set(['S1','S2','S3','S4','S5','M1','M2','M3','M4','L1','L2','L3','L4','XL1','XL2','XL3',
  'Kreuzfahrtschiff','Marineschiff','Seenotrettungskreuzer']);
const pflicht = ['id','name','hafenname','vorbilder','freischalten','karte','kueste','farben','licht','bauweise',
  'natur','wasser','wetter','schiffe','spiel','platzarten','dienste','bauprojekte','ereignisse','musik'];

assert.deepEqual(Object.keys(REVIERE).sort(), [...REVIER_REIHENFOLGE].sort(), 'Reihenfolge passt nicht zu REVIERE');
for (const [id, r] of Object.entries(REVIERE)) {
  for (const f of pflicht) assert.ok(r[f] !== undefined, `${id}: Feld ${f} fehlt`);
  assert.equal(r.id, id, `${id}: id stimmt nicht`);
  for (const [k, v] of Object.entries(r.farben)) assert.match(v, farbe, `${id}: farben.${k}`);
  for (const ph of ['tag', 'abend']) {
    for (const k of ['himmel', 'boden', 'sonne']) assert.match(r.licht[ph][k], farbe, `${id}: licht.${ph}.${k}`);
    assert.ok(r.licht[ph].staerke > 0, `${id}: licht.${ph}.staerke`);
  }
  for (const c of [...r.bauweise.waende, ...r.bauweise.daecher, r.bauweise.holz, r.bauweise.akzent, r.bauweise.fensterAbend])
    assert.match(c, farbe, `${id}: bauweise-Farbe ${c}`);
  for (const a of [...Object.keys(r.schiffe.haeufigkeit), ...Object.keys(r.schiffe.abStufe)])
    assert.ok(arten.has(a), `${id}: unbekannte Schiffsart ${a}`);
  const f = r.freischalten;
  assert.ok(f.start || (REVIERE[f.nach] && f.stufe >= 1 && f.stufe <= 6), `${id}: freischalten`);
  for (const w of ['sturm', 'nebel', 'regen']) assert.ok(r.wetter[w] >= 0 && r.wetter[w] <= 1, `${id}: wetter.${w}`);
  assert.ok(r.spiel.naechte[0] <= r.spiel.naechte[1], `${id}: naechte`);
}
assert.equal(REVIERE[REVIER_REIHENFOLGE[0]].freischalten.start, true, 'erstes Revier muss frei sein');

// Ostsee: keine Tide
const ost = REVIERE.ostsee;
for (let t = 0; t < 3; t += 0.1) assert.equal(wasserstand(ost, t), 0);
assert.equal(passt(ost, 0, 1.4, 1.7), true);
assert.equal(passt(ost, 0, 1.5, 1.7), false);
assert.equal(naechstesFenster(ost, 0, 2.0, 1.7), Infinity);

// Nordsee: Wasserstand zwischen etwa 0 und Hub, Pegel um 0
const nord = REVIERE.nordsee;
const hub = nord.wasser.tide.hub;
let min = Infinity, max = -Infinity, pmin = Infinity, pmax = -Infinity;
for (let t = 0; t < 30; t += 0.005) {
  const w = wasserstand(nord, t); min = Math.min(min, w); max = Math.max(max, w);
  const p = pegel(nord, t); pmin = Math.min(pmin, p); pmax = Math.max(pmax, p);
}
const s = nord.wasser.tide.springFaktor;
assert.ok(Math.abs(min - (hub / 2 - hub / 2 * (1 + s))) < 0.05, `Niedrigwasser ${min}`);
assert.ok(Math.abs(max - (hub / 2 + hub / 2 * (1 + s))) < 0.05, `Hochwasser ${max}`);
assert.ok(Math.abs(pmin + pmax) < 0.05, 'Pegel nicht symmetrisch um 0');

// Ein Kutter mit 1,0 m Tiefgang an einem Platz mit 0,5 m Kartentiefe: nicht immer, aber taeglich
let jaZeiten = 0, n = 0;
for (let t = 0; t < 15; t += 0.01) { n++; if (passt(nord, t, 1.0, 0.5)) jaZeiten++; }
assert.ok(jaZeiten > 0.2 * n && jaZeiten < 0.9 * n, `Tidenfenster unplausibel: ${jaZeiten}/${n}`);
for (let t = 0; t < 5; t += 0.37) {
  const d = naechstesFenster(nord, t, 1.0, 0.5);
  assert.ok(d < 1.1, `kein Fenster innerhalb eines Tages ab ${t}`);
  assert.ok(passt(nord, t + d, 1.0, 0.5));
}
// zu tief fuer jede Tide
assert.equal(naechstesFenster(nord, 0, 5.0, 0.5), Infinity);
// Hafen mit eigenem Tidenhub
assert.ok(wasserstand(nord, 0.25, 1.0) < 1.3);

// Freischalten
assert.equal(istFrei(REVIERE.ostsee, {}), true);
assert.equal(istFrei(REVIERE.daenemark, { ostsee: 4 }), false);
assert.equal(istFrei(REVIERE.daenemark, { ostsee: 5 }), true);
assert.equal(istFrei(REVIERE.nordsee, { ostsee: 6, daenemark: 6 }), false);

console.log(`OK: ${Object.keys(REVIERE).length} Reviere, Niedrigwasser ${min.toFixed(2)} m, Hochwasser ${max.toFixed(2)} m`);
