// Reviere freischalten (P57 Teil 5, docs/nordsee.md): Nordsee ab Ostsee-Stufe 5, Startgeld aus dem Ruf.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../web/js/save/reviere.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { stufenName } from '../web/js/data/kuestennamen.js';

function speicher() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
const AB = ECONOMY.nordsee.start.abStufe;

test('Nordsee ist am Anfang gesperrt und wird mit der Stufe an der Ostsee frei', () => {
  const s = speicher();
  assert.equal(R.nordseeFrei(s), false);
  assert.equal(R.merken(s, { stage: AB - 1, region: 'ostsee' }, 3.5), false);
  assert.equal(R.nordseeFrei(s), false);
  assert.equal(R.merken(s, { stage: AB, region: 'ostsee' }, 4.1), true, 'meldet einmal: gerade frei geworden');
  assert.equal(R.nordseeFrei(s), true);
  assert.equal(R.merken(s, { stage: AB, region: 'ostsee' }, 4.3), false, 'nur beim ersten Mal');
  // Nie schlechter: ein späterer kleiner Hafen sperrt nichts
  R.merken(s, { stage: 1, region: 'ostsee' }, 1);
  assert.equal(R.lesen(s).ostsee.stufe, AB);
  assert.equal(R.lesen(s).ostsee.ruf, 4.3);
});

test('Nordsee-Häfen, Testmodus und Probe-Kopien schalten nichts frei', () => {
  const s = speicher();
  R.merken(s, { stage: 6, region: 'nordsee' }, 5);
  R.merken(s, { stage: 6, region: 'ostsee', testmodus: true }, 5);
  assert.equal(R.nordseeFrei(s), false);
  const v = { plaetze: [{ id: 'p1', info: { stufe: 6, region: 'nordsee' } }, { id: 'p2', probeVon: 'p1', info: { stufe: 6, region: 'ostsee' } }] };
  assert.equal(R.nordseeFrei(s, v), false);
});

test('Alter Spielstand im Verzeichnis zählt sofort', () => {
  const s = speicher();
  const v = { plaetze: [{ id: 'p1', info: { stufe: AB, tag: 80, geld: 9000 } }] };   // ohne region: Ostsee
  assert.equal(R.nordseeFrei(s, v), true);
  assert.equal(R.besteOstseeStufe(s, v), AB);
});

test('Startgeld aus dem Ruf, gerundet und begrenzt', () => {
  const st = ECONOMY.nordsee.start;
  assert.equal(R.startgeld(4), Math.round((4 * st.geldJeAnker) / 100) * 100);
  assert.equal(R.startgeld(0), st.geldMin);
  assert.equal(R.startgeld(99), st.geldMax);
  assert.equal(R.startgeld(NaN), st.geldMin);
  const s = speicher();
  assert.equal(R.startgeldGemerkt(s), st.geldMin);
  R.merken(s, { stage: 5, region: 'ostsee' }, 4.5);
  assert.equal(R.startgeldGemerkt(s), R.startgeld(4.5));
});

test('Kaputter Merkzettel wird ignoriert', () => {
  const s = speicher();
  s.setItem(R.KEY_REVIERE, '{kaputt');
  assert.deepEqual(R.lesen(s), {});
  s.setItem(R.KEY_REVIERE, JSON.stringify({ ostsee: { stufe: 'x', ruf: 99 } }));
  assert.deepEqual(R.lesen(s), { ostsee: { stufe: 0, ruf: 5 } });
});

test('Stufenname je Revier für die Liste der Spielstände', () => {
  assert.notEqual(stufenName(3, 'nordsee'), stufenName(3, 'ostsee'));
  assert.equal(stufenName(4, 'nordsee'), stufenName(4, 'ostsee'));
});
