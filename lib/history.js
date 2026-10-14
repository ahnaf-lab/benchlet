'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_HISTORY_FILE = '.benchlet-history.json';
const DEFAULT_MAX_ENTRIES = 50;

function assertFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('filePath must be a non-empty string');
  }
}

function assertName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('name must be a non-empty string');
  }
}

function assertStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    throw new TypeError('stats must be a plain object of computed metrics');
  }
}

/**
 * Reads the history store from `filePath`. A missing file is treated as
 * an empty store so the first recorded run can create one.
 *
 * @param {string} filePath - path to the history JSON file.
 * @returns {Object<string, Array<{timestamp: number, stats: object}>>}
 */
function readStore(filePath) {
  assertFilePath(filePath);

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }

  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`history file ${filePath} must contain a JSON object`);
  }
  return parsed;
}

function writeStore(filePath, store) {
  assertFilePath(filePath);

  const dir = path.dirname(filePath);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

/**
 * Appends a `{ timestamp, stats }` entry to the named history series in
 * `filePath`, trimming to the `maxEntries` most recent entries so the file
 * doesn't grow without bound.
 *
 * @param {string} filePath - path to the history JSON file.
 * @param {string} name - benchmark/case name, as used in baseline keys.
 * @param {object} stats - stats object to record, e.g. from `computeStats()`.
 * @param {Object} [options]
 * @param {number} [options.maxEntries=50] - entries kept per name.
 * @returns {Array<{timestamp: number, stats: object}>} the series for `name`
 *   after the append.
 */
function appendHistory(filePath, name, stats, options = {}) {
  assertName(name);
  assertStats(stats);
  const { maxEntries = DEFAULT_MAX_ENTRIES } = options;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError('options.maxEntries must be a positive integer');
  }

  const store = readStore(filePath);
  const series = Array.isArray(store[name]) ? store[name] : [];
  series.push({ timestamp: Date.now(), stats });
  store[name] = series.slice(-maxEntries);

  writeStore(filePath, store);
  return store[name];
}

/**
 * Loads the recorded history series for a single named benchmark.
 *
 * @param {string} filePath - path to the history JSON file.
 * @param {string} name - benchmark/case name, as used in baseline keys.
 * @returns {Array<{timestamp: number, stats: object}>} empty when no
 *   history has been recorded yet for that name.
 */
function loadHistory(filePath, name) {
  assertName(name);
  const store = readStore(filePath);
  return Array.isArray(store[name]) ? store[name] : [];
}

/**
 * Lists the benchmark/case names that have recorded history in `filePath`.
 *
 * @param {string} filePath - path to the history JSON file.
 * @returns {string[]}
 */
function listHistoryNames(filePath) {
  const store = readStore(filePath);
  return Object.keys(store);
}

module.exports = {
  DEFAULT_HISTORY_FILE,
  appendHistory,
  loadHistory,
  listHistoryNames,
};
