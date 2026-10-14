'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSparkline, BLOCKS } = require('../index');

test('renderSparkline maps an ascending ramp across the full block range', () => {
  const values = [0, 1, 2, 3, 4, 5, 6, 7];
  const line = renderSparkline(values);

  assert.equal(line, BLOCKS.join(''));
  assert.equal(line.length, values.length);
});

test('renderSparkline is deterministic for the same input', () => {
  const values = [3, 1, 4, 1, 5, 9, 2, 6];
  assert.equal(renderSparkline(values), renderSparkline(values));
});

test('renderSparkline renders a flat mid-level line when all values are equal', () => {
  const line = renderSparkline([5, 5, 5, 5]);
  assert.equal(line, BLOCKS[3].repeat(4));
});

test('renderSparkline scales relative to the series min/max, not absolute units', () => {
  const small = renderSparkline([1, 2, 3]);
  const large = renderSparkline([1000, 2000, 3000]);
  assert.equal(small, large);
});

test('renderSparkline handles a single value as a flat line', () => {
  assert.equal(renderSparkline([42]), BLOCKS[3]);
});

test('renderSparkline rejects empty or non-numeric input', () => {
  assert.throws(() => renderSparkline([]), TypeError);
  assert.throws(() => renderSparkline('nope'), TypeError);
  assert.throws(() => renderSparkline([1, NaN, 3]), TypeError);
  assert.throws(() => renderSparkline([1, Infinity]), TypeError);
});
