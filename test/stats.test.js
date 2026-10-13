'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStats, summarize, percentile } = require('../index');

const EPSILON = 1e-9;

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < EPSILON,
    `${message}: expected ${expected}, got ${actual}`
  );
}

test('computeStats matches hand-computed values for 1..10', () => {
  // sorted 1..10, n = 10
  // p50: rank = 0.5 * 9 = 4.5 -> interpolate samples[4]=5, samples[5]=6 -> 5.5
  // p95: rank = 0.95 * 9 = 8.55 -> interpolate samples[8]=9, samples[9]=10 -> 9.55
  // p99: rank = 0.99 * 9 = 8.91 -> interpolate samples[8]=9, samples[9]=10 -> 9.91
  // mean = 5.5
  // population variance = 82.5 / 10 = 8.25 -> stddev = sqrt(8.25)
  const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const stats = computeStats(samples);

  assert.equal(stats.count, 10);
  assert.equal(stats.min, 1);
  assert.equal(stats.max, 10);
  assertClose(stats.mean, 5.5, 'mean');
  assertClose(stats.stddev, Math.sqrt(8.25), 'stddev');
  assertClose(stats.p50, 5.5, 'p50');
  assertClose(stats.p95, 9.55, 'p95');
  assertClose(stats.p99, 9.91, 'p99');
});

test('computeStats matches hand-computed values for [10, 20, 30, 40]', () => {
  // sorted as-is, n = 4
  // p50: rank = 0.5 * 3 = 1.5 -> interpolate samples[1]=20, samples[2]=30 -> 25
  // p95: rank = 0.95 * 3 = 2.85 -> interpolate samples[2]=30, samples[3]=40 -> 38.5
  // p99: rank = 0.99 * 3 = 2.97 -> interpolate samples[2]=30, samples[3]=40 -> 39.7
  // mean = 25
  // population variance = 500 / 4 = 125 -> stddev = sqrt(125)
  const samples = [40, 10, 30, 20]; // unsorted input on purpose
  const stats = computeStats(samples);

  assert.equal(stats.min, 10);
  assert.equal(stats.max, 40);
  assertClose(stats.mean, 25, 'mean');
  assertClose(stats.stddev, Math.sqrt(125), 'stddev');
  assertClose(stats.p50, 25, 'p50');
  assertClose(stats.p95, 38.5, 'p95');
  assertClose(stats.p99, 39.7, 'p99');
});

test('computeStats handles a single sample with zero spread', () => {
  const stats = computeStats([42]);

  assert.equal(stats.count, 1);
  assert.equal(stats.min, 42);
  assert.equal(stats.max, 42);
  assert.equal(stats.mean, 42);
  assert.equal(stats.stddev, 0);
  assert.equal(stats.p50, 42);
  assert.equal(stats.p95, 42);
  assert.equal(stats.p99, 42);
});

test('computeStats reports zero stddev for identical samples', () => {
  const stats = computeStats([3, 3, 3, 3]);
  assert.equal(stats.stddev, 0);
  assert.equal(stats.p50, 3);
});

test('computeStats is order-independent', () => {
  const a = computeStats([5, 1, 3, 2, 4]);
  const b = computeStats([1, 2, 3, 4, 5]);
  assert.deepEqual(a, b);
});

test('computeStats rejects empty or non-numeric input', () => {
  assert.throws(() => computeStats([]), TypeError);
  assert.throws(() => computeStats('not an array'), TypeError);
  assert.throws(() => computeStats([1, 'two', 3]), TypeError);
  assert.throws(() => computeStats([1, NaN, 3]), TypeError);
});

test('percentile helper matches the documented linear-interpolation formula', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assertClose(percentile(sorted, 50), 5.5, 'p50');
  assertClose(percentile(sorted, 0), 1, 'p0');
  assertClose(percentile(sorted, 100), 10, 'p100');
});

test('summarize attaches stats to each benchmark result without losing samples', () => {
  const results = [
    { name: 'a', samples: [10, 20, 30, 40] },
    { name: 'b', samples: [42] },
  ];

  const summarized = summarize(results);

  assert.equal(summarized.length, 2);
  assert.equal(summarized[0].name, 'a');
  assert.deepEqual(summarized[0].samples, [10, 20, 30, 40]);
  assertClose(summarized[0].stats.mean, 25, 'summarized mean');
  assertClose(summarized[0].stats.p50, 25, 'summarized p50');
  assert.equal(summarized[1].stats.stddev, 0);
});

test('summarize rejects non-array input', () => {
  assert.throws(() => summarize({ not: 'an array' }), TypeError);
});
