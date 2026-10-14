'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendHistory, loadHistory, listHistoryNames } = require('../index');

function tempHistoryPath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'benchlet-history-')),
    'history.json'
  );
}

test('loadHistory returns an empty array when nothing has been recorded', () => {
  const filePath = tempHistoryPath();
  assert.deepEqual(loadHistory(filePath, 'my-bench'), []);
});

test('appendHistory records each call as a new entry with current stats', () => {
  const filePath = tempHistoryPath();

  appendHistory(filePath, 'my-bench', { p95: 1 });
  appendHistory(filePath, 'my-bench', { p95: 2 });
  const series = appendHistory(filePath, 'my-bench', { p95: 3 });

  assert.equal(series.length, 3);
  assert.deepEqual(series.map((entry) => entry.stats.p95), [1, 2, 3]);
  for (const entry of series) {
    assert.equal(typeof entry.timestamp, 'number');
  }
  assert.deepEqual(loadHistory(filePath, 'my-bench'), series);
});

test('appendHistory keeps separate series per name', () => {
  const filePath = tempHistoryPath();

  appendHistory(filePath, 'bench-a', { p95: 10 });
  appendHistory(filePath, 'bench-b', { p95: 20 });

  assert.equal(loadHistory(filePath, 'bench-a').length, 1);
  assert.equal(loadHistory(filePath, 'bench-b').length, 1);
  assert.equal(loadHistory(filePath, 'bench-a')[0].stats.p95, 10);
});

test('appendHistory trims to maxEntries, dropping the oldest first', () => {
  const filePath = tempHistoryPath();

  for (let i = 0; i < 5; i++) {
    appendHistory(filePath, 'my-bench', { p95: i }, { maxEntries: 3 });
  }

  const series = loadHistory(filePath, 'my-bench');
  assert.equal(series.length, 3);
  assert.deepEqual(series.map((entry) => entry.stats.p95), [2, 3, 4]);
});

test('listHistoryNames reports every recorded name, and an empty array for a missing file', () => {
  const filePath = tempHistoryPath();
  assert.deepEqual(listHistoryNames(filePath), []);

  appendHistory(filePath, 'bench-a', { p95: 1 });
  appendHistory(filePath, 'bench-b', { p95: 2 });

  assert.deepEqual(listHistoryNames(filePath).sort(), ['bench-a', 'bench-b']);
});

test('appendHistory rejects invalid arguments', () => {
  const filePath = tempHistoryPath();
  assert.throws(() => appendHistory(filePath, '', { p95: 1 }), TypeError);
  assert.throws(() => appendHistory(filePath, 'ok', null), TypeError);
  assert.throws(() => appendHistory(filePath, 'ok', { p95: 1 }, { maxEntries: 0 }), TypeError);
});
