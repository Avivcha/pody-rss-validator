// Smoke test — the real test suite ships in v0.2.
// Validates the cli entry compiles and the public type is exported.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/index.js';

test('validate is a function', () => {
  assert.equal(typeof validate, 'function');
});
