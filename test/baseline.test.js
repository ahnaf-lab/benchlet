'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  loadBaseline,
  saveBaseline,
  diffStats,
  compareToBaseline,
} = require('../index');

function tempBaselinePath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'benchlet-baseline-')),
    'baseline.json'
  );
}

test('loadBaseline returns undefined when the file does not exist yet', () => {
  const filePath = tempBaselinePath();
  assert.equal(loadBaseline(filePath, 'my-bench'), undefined);
});

test('saveBaseline writes a named entry that loadBaseline reads back', () => {
  const filePath = tempBaselinePath();
  const stats = { count: 10, min: 1, max: 5, mean: 3, stddev: 1.2, p50: 3, p95: 4.8, p99: 4.98 };

  saveBaseline(filePath, 'my-bench', stats);

  assert.deepEqual(loadBaseline(filePath, 'my-bench'), stats);
  assert.ok(fs.existsSync(filePath));
  const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(onDisk['my-bench'], stats);
});

test('saveBaseline preserves other named entries already in the store', () => {
  const filePath = tempBaselinePath();
  saveBaseline(filePath, 'bench-a', { p50: 1, p95: 2, p99: 3 });
  saveBaseline(filePath, 'bench-b', { p50: 10, p95: 20, p99: 30 });

  assert.deepEqual(loadBaseline(filePath, 'bench-a'), { p50: 1, p95: 2, p99: 3 });
  assert.deepEqual(loadBaseline(filePath, 'bench-b'), { p50: 10, p95: 20, p99: 30 });
});

test('saveBaseline overwrites a previous entry for the same name', () => {
  const filePath = tempBaselinePath();
  saveBaseline(filePath, 'bench-a', { p50: 1 });
  saveBaseline(filePath, 'bench-a', { p50: 2 });

  assert.deepEqual(loadBaseline(filePath, 'bench-a'), { p50: 2 });
});

test('diffStats computes absolute and percent deltas for shared metrics', () => {
  const baseline = { p50: 10, p95: 20, p99: 30, mean: 15 };
  const current = { p50: 12, p95: 18, p99: 30, mean: 15 };

  const diff = diffStats(current, baseline);

  assert.equal(diff.p50.absolute, 2);
  assert.equal(diff.p50.percent, 20);
  assert.equal(diff.p95.absolute, -2);
  assert.equal(diff.p95.percent, -10);
  assert.equal(diff.p99.absolute, 0);
  assert.equal(diff.p99.percent, 0);
  assert.equal(diff.mean.absolute, 0);
});

test('diffStats treats a zero baseline specially to avoid dividing by zero', () => {
  const diffSame = diffStats({ p50: 0 }, { p50: 0 });
  assert.equal(diffSame.p50.percent, 0);

  const diffRegressed = diffStats({ p50: 5 }, { p50: 0 });
  assert.equal(diffRegressed.p50.percent, Infinity);
});

test('compareToBaseline reports no baseline for an unseen name', () => {
  const filePath = tempBaselinePath();
  const result = compareToBaseline(filePath, 'new-bench', { p50: 5 });

  assert.equal(result.baseline, null);
  assert.equal(result.delta, null);
  assert.deepEqual(result.current, { p50: 5 });
});

test('compareToBaseline loads the stored baseline and returns its delta', () => {
  const filePath = tempBaselinePath();
  saveBaseline(filePath, 'my-bench', { p50: 10, p95: 20, p99: 30 });

  const result = compareToBaseline(filePath, 'my-bench', { p50: 11, p95: 20, p99: 30 });

  assert.deepEqual(result.baseline, { p50: 10, p95: 20, p99: 30 });
  assert.equal(result.delta.p50.absolute, 1);
  assert.equal(result.delta.p50.percent, 10);
  assert.equal(result.delta.p95.absolute, 0);
});

test('rejects invalid arguments', () => {
  const filePath = tempBaselinePath();
  assert.throws(() => loadBaseline(filePath, ''), TypeError);
  assert.throws(() => saveBaseline(filePath, 'ok', null), TypeError);
  assert.throws(() => saveBaseline(filePath, '', { p50: 1 }), TypeError);
  assert.throws(() => diffStats(null, { p50: 1 }), TypeError);
});

test('a corrupt baseline file surfaces a clear error instead of silently resetting', () => {
  const filePath = tempBaselinePath();
  fs.writeFileSync(filePath, '[1, 2, 3]');

  assert.throws(() => loadBaseline(filePath, 'my-bench'), TypeError);
});
