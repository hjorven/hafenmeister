import { test } from 'node:test';
import assert from 'node:assert/strict';
import { darfSchauen } from '../web/js/features/hafen-schauen.js';
import { RULES } from './regeln.mjs';

test('Hafen schauen erst, wenn das Hafenbüro selbst zuweist', () => {
  const stufe = RULES.office.autoAssign;
  assert.equal(darfSchauen({ office: stufe - 1 }, RULES), false);
  assert.equal(darfSchauen({ office: stufe }, RULES), true);
  assert.equal(darfSchauen({}, RULES), false);
});
