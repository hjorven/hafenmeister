// Namen je Küste (P85 Teil 3): Der Ausbau zu Stufe 3 heißt nur dort "Durchstich", wo am Engpass Land liegt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formSetzen, engpassArt } from '../web/js/render/landschaft/formen.js';
import { stufenName, ausbauName } from '../web/js/data/kuestennamen.js';
import { ECONOMY } from '../web/js/data/economy.js';
import { RULES } from '../web/js/data/rules.js';

const stufe2 = ECONOMY.stufen.find((s) => s.stufe === 2);

test('Nehrung und Shilshole Bay: Durchstich zur Ostsee', () => {
  for (const [nr, seed] of [[1, 1], [1, 2], [13, 1], [13, 7]]) {
    formSetzen(nr, seed);
    assert.equal(engpassArt(), 'durchstich', `Küste ${nr}, Seed ${seed}`);
    assert.equal(ausbauName(stufe2), 'Durchstich zur Ostsee');
    assert.equal(stufenName(3), 'Durchstich zur Ostsee');
    assert.equal(RULES.stageGoals[2].name, 'Durchstich zur Ostsee');
  }
});

test('Offene Küsten: Molen und Wellenbrecher statt Durchstich', () => {
  for (const nr of [2, 4, 6, 8, 10, 11, 12, 14, 15]) {
    formSetzen(nr, 1);
    assert.equal(engpassArt(), 'einfahrt', `Küste ${nr}`);
    assert.equal(ausbauName(stufe2), stufe2.ausbau.nameOffen);
    assert.equal(stufenName(3), ECONOMY.stufen[2].nameOffen);
    assert.equal(RULES.stageGoals[2].name, stufe2.ausbau.nameOffen);
  }
  formSetzen(1, 1);
});

test('Andere Stufen behalten ihren Namen', () => {
  formSetzen(2, 1);
  for (const s of ECONOMY.stufen) if (s.stufe !== 3) assert.equal(stufenName(s.stufe), s.name);
  formSetzen(1, 1);
});
