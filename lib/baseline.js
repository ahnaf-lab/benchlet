'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { METRICS } = require('./metrics');

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
 * Reads the baseline store from `filePath`. A missing file is treated as
 * an empty store so the first run of a benchmark can create one.
 *
 * @param {string} filePath - path to the baseline JSON file.
 * @returns {Object<string, object>} store keyed by benchmark name.
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
    throw new TypeError(`baseline file ${filePath} must contain a JSON object`);
  }
  return parsed;
}

/**
 * Writes the baseline store to `filePath` as pretty-printed JSON,
 * creating parent directories as needed.
 *
 * @param {string} filePath - path to the baseline JSON file.
 * @param {Object<string, object>} store - store keyed by benchmark name.
 */
function writeStore(filePath, store) {
  assertFilePath(filePath);
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    throw new TypeError('store must be a plain object of named baselines');
  }

  const dir = path.dirname(filePath);
  if (dir && dir !== '.') {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

/**
 * Loads the recorded baseline stats for a single named benchmark.
 *
 * @param {string} filePath - path to the baseline JSON file.
 * @param {string} name - benchmark name, as used in `summarize()` results.
 * @returns {object|undefined} the stored stats, or undefined if no
 *   baseline has been recorded yet for that name.
 */
function loadBaseline(filePath, name) {
  assertName(name);
  const store = readStore(filePath);
  return store[name];
}

/**
 * Records `stats` as the new baseline for `name`, leaving any other
 * named baselines in the store untouched.
 *
 * @param {string} filePath - path to the baseline JSON file.
 * @param {string} name - benchmark name, as used in `summarize()` results.
 * @param {object} stats - the stats object to persist (e.g. from
 *   `computeStats()`).
 * @returns {Object<string, object>} the full updated store.
 */
function saveBaseline(filePath, name, stats) {
  assertName(name);
  assertStats(stats);

  const store = readStore(filePath);
  store[name] = stats;
  writeStore(filePath, store);
  return store;
}

/**
 * Computes the per-metric delta between `current` stats and a `baseline`
 * stats object, for every shared numeric metric (min, max, mean, stddev,
 * p50, p95, p99).
 *
 * @param {object} current - stats to compare, e.g. from `computeStats()`.
 * @param {object} baseline - previously recorded stats to compare against.
 * @returns {Object<string, {current: number, baseline: number,
 *   absolute: number, percent: number}>}
 */
function diffStats(current, baseline) {
  assertStats(current);
  assertStats(baseline);

  const diff = {};
  for (const metric of METRICS) {
    const curr = current[metric];
    const base = baseline[metric];
    if (typeof curr !== 'number' || typeof base !== 'number') {
      continue;
    }
    const absolute = curr - base;
    const percent = base === 0 ? (curr === 0 ? 0 : Infinity) : (absolute / base) * 100;
    diff[metric] = { current: curr, baseline: base, absolute, percent };
  }
  return diff;
}

/**
 * Loads the stored baseline for `name` and computes its delta against
 * `current` stats in one step.
 *
 * @param {string} filePath - path to the baseline JSON file.
 * @param {string} name - benchmark name, as used in `summarize()` results.
 * @param {object} current - stats to compare, e.g. from `computeStats()`.
 * @returns {{name: string, current: object, baseline: object|null,
 *   delta: object|null}} `baseline` and `delta` are null when no baseline
 *   has been recorded yet for `name`.
 */
function compareToBaseline(filePath, name, current) {
  assertStats(current);
  const baseline = loadBaseline(filePath, name);
  if (baseline === undefined) {
    return { name, current, baseline: null, delta: null };
  }
  return { name, current, baseline, delta: diffStats(current, baseline) };
}

module.exports = { loadBaseline, saveBaseline, diffStats, compareToBaseline };
