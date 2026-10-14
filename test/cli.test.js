'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { main } = require('../bin/benchlet');
const { appendHistory } = require('../index');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'benchlet.js');

function tempHistoryPath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'benchlet-cli-')),
    'history.json'
  );
}

function capture(argv) {
  const logs = [];
  const errors = [];
  const code = main(argv, {
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
  });
  return { code, logs, errors };
}

test('prints a message when no history has been recorded yet', () => {
  const filePath = tempHistoryPath();
  const { code, logs } = capture(['--file', filePath]);

  assert.equal(code, 0);
  assert.ok(logs.some((line) => line.includes('No benchmark history recorded')));
});

test('renders a sparkline line with the metric, latest value, and sample count', () => {
  const filePath = tempHistoryPath();
  appendHistory(filePath, 'handleToolCall', { p95: 1.2 });
  appendHistory(filePath, 'handleToolCall', { p95: 1.5 });
  appendHistory(filePath, 'handleToolCall', { p95: 1.3 });

  const { code, logs } = capture(['--file', filePath, '--metric', 'p95']);

  assert.equal(code, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /handleToolCall/);
  assert.match(logs[0], /p95 latest=1\.300ms/);
  assert.match(logs[0], /\(n=3\)/);
  // one of the sparkline block characters should be present in the line
  assert.match(logs[0], /[▁-█]/);
});

test('--name filters to a single recorded benchmark', () => {
  const filePath = tempHistoryPath();
  appendHistory(filePath, 'bench-a', { p95: 1 });
  appendHistory(filePath, 'bench-b', { p95: 2 });

  const { logs } = capture(['--file', filePath, '--name', 'bench-a']);

  assert.equal(logs.length, 1);
  assert.match(logs[0], /bench-a/);
});

test('rejects an unknown metric and an unknown flag', () => {
  const filePath = tempHistoryPath();
  appendHistory(filePath, 'bench-a', { p95: 1 });

  const unknownMetric = capture(['--file', filePath, '--metric', 'bogus']);
  assert.equal(unknownMetric.code, 1);
  assert.ok(unknownMetric.errors.length > 0);

  const unknownFlag = capture(['--nope']);
  assert.equal(unknownFlag.code, 1);
});

test('the bin entry point runs as a real subprocess and exits 0', () => {
  const filePath = tempHistoryPath();
  appendHistory(filePath, 'handleToolCall', { p95: 2.5 });

  const output = execFileSync(process.execPath, [CLI_PATH, '--file', filePath], {
    encoding: 'utf8',
  });

  assert.match(output, /handleToolCall/);
});
