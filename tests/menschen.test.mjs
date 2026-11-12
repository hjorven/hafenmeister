// Tests für die Menschen im Hafen: Wegenetz (web/js/people/netz.js) und Crew-Zahlen (web/js/people/crew.js).
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { baueNetz } from '../web/js/people/netz.js';
import { crewFuer, figurenFuer } from '../web/js/people/crew.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { CREW_STANDARD, EINZELN_BIS, MAX_FIGUREN } from '../web/js/data/people.js';

// Gebäude wie in web/js/render/buildings.js (Planeinheiten), Auswahl
const GEB = [
  { id: 'toilette', art: 'toilette', x: -95, y: -32 },
  { id: 'kiosk', art: 'kiosk', x: -36, y: -30 },
  { id: 'restaurant', art: 'restaurant', x: 48, y: -34, halbBreite: 13 },
  { id: 'haus-1', art: 'wohnhaus', x: -150, y: -46 },
  { id: 'seebruecke', art: 'seebruecke', x: -170, y: 216 },
  { id: 'koerbe-1', art: 'strandkoerbe', x: -210, y: 218 },
  { id: 'fischbuden', art: 'kiosk', x: 108, y: 204 },
];

for (const stufe of [1, 2, 3, 4, 5]) {
  test(`Stufe ${stufe}: jeder Liegeplatz hat einen Weg zu einem echten Ziel und zurück`, () => {
    const netz = baueNetz({ hafen: HAFEN, stufe, gebaeude: GEB });
    const anzahl = HAFEN.plaetze.filter((p) => p.stufen.includes(stufe)).length;
    assert.equal(netz.plaetze.size, anzahl);
    for (const [id, p] of netz.plaetze) {
      const ziele = netz.ziele.filter((z) => z.art !== 'aussicht' && netz.komp[z.node] === netz.komp[p.node]);
      assert.ok(ziele.length > 0, `${id} erreicht kein Ziel`);
      const hin = netz.weg(p.node, ziele[0].node);
      const zurueck = netz.weg(ziele[0].node, p.node);
      assert.ok(hin && zurueck, `${id}: kein Weg`);
      // Boote anderer Plätze werden nicht als Abkürzung benutzt
      assert.ok(hin.slice(1).every((n) => netz.nodes[n].art !== 'boot'), `${id}: Weg über ein fremdes Boot`);
    }
  });

  test(`Stufe ${stufe}: Festland und Nehrung sind die einzigen Flächen, Spaziergänger haben ein Zuhause`, () => {
    const netz = baueNetz({ hafen: HAFEN, stufe, gebaeude: GEB });
    assert.equal(new Set(netz.komp).size, 2);
    assert.ok(netz.zuhause.length >= 3);
  });
}

test('Einstieg liegt dicht am Boot (am eigenen Steg)', () => {
  const netz = baueNetz({ hafen: HAFEN, stufe: 4, gebaeude: GEB });
  for (const [id, p] of netz.plaetze) {
    const e = netz.nodes[p.einstieg];
    const d = Math.hypot(e.x - p.x, e.y - p.y) * 0.62;
    assert.ok(d < 20, `${id}: Einstieg ${d.toFixed(1)} m vom Boot`);
  }
});

test('Crew aus den Schiffsdaten, sonst Standard je Größe', () => {
  assert.deepEqual(crewFuer({ groesse: 'L', art: 'L1' }), [2, 6]);
  assert.deepEqual(crewFuer({ groesse: 'M', art: 'M3' }), [2, 5]);
  assert.deepEqual(crewFuer({ groesse: 'XXL' }), CREW_STANDARD.xxl);
  assert.deepEqual(crewFuer({ groesse: 'S', art: 'gibtsnicht' }), CREW_STANDARD.s);
});

test('große Schiffe werden gebündelt, nie mehr als die Höchstzahl', () => {
  assert.equal(figurenFuer(3), 3);
  assert.equal(figurenFuer(EINZELN_BIS), EINZELN_BIS);
  assert.ok(figurenFuer(200) < 60);
  assert.ok(MAX_FIGUREN <= 300);
});
