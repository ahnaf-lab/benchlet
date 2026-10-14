'use strict';

const { benchmark } = require('./benchmark');
const { summarize } = require('./stats');
const { loadBaseline, saveBaseline, diffStats } = require('./baseline');
const { appendHistory } = require('./history');
const { METRICS: STAT_METRICS } = require('./metrics');

const DEFAULT_BASELINE_FILE = '.benchlet-baseline.json';
const DEFAULT_METRIC = 'p95';

class RegressionError extends Error {
  constructor(message, diff) {
    super(message);
    this.name = 'RegressionError';
    this.diff = diff;
  }
}

function assertThreshold(pct) {
  if (typeof pct !== 'number' || Number.isNaN(pct) || pct < 0) {
    throw new TypeError('pct must be a non-negative number');
  }
}

function assertMetric(metric) {
  if (!STAT_METRICS.includes(metric)) {
    throw new TypeError(`metric must be one of ${STAT_METRICS.join(', ')}`);
  }
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function buildReport(label, failures) {
  const lines = [`Regression check failed for "${label}":`];
  for (const entry of failures) {
    lines.push(
      `  case "${entry.case}" ${entry.metric} regressed ${entry.percent.toFixed(1)}% ` +
        `(baseline ${formatMs(entry.baseline)} -> current ${formatMs(entry.current)}), exceeds threshold ${entry.threshold}%`
    );
  }
  return lines.join('\n');
}

/**
 * Benchmarks `fn` against `cases`, then exposes assertions that compare
 * the result against a recorded baseline.
 *
 * @param {Function} fn - function under test, passed to `benchmark()`.
 * @param {Array|Object} cases - fixture inputs, as accepted by `benchmark()`.
 * @param {Object} [options]
 * @param {number} [options.warmup] - forwarded to `benchmark()`.
 * @param {number} [options.iterations] - forwarded to `benchmark()`.
 * @returns {{ toRegressNoMoreThan: Function }}
 */
function expectBenchmark(fn, cases, options = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  const { warmup, iterations } = options;

  return {
    /**
     * Fails if any case's chosen metric regressed by more than `pct`
     * percent versus its recorded baseline. A case with no recorded
     * baseline yet is never failed; instead its current stats are saved
     * as the new baseline, so the first run always establishes one
     * instead of throwing.
     *
     * @param {number} pct - maximum allowed regression, in percent.
     * @param {Object} [assertOptions]
     * @param {string} [assertOptions.baselineFile='.benchlet-baseline.json']
     *   path to the JSON baseline store.
     * @param {string} [assertOptions.historyFile] - path to a JSON history
     *   store; when given, every run's stats are appended there (even
     *   regressed ones) so `npx benchlet` has a trend to render. Off by
     *   default so assertion runs never write files the caller didn't ask for.
     * @param {string} [assertOptions.name] - benchmark suite name, used to
     *   prefix each case's baseline key and in the failure message;
     *   defaults to `fn.name` or `'benchmark'`.
     * @param {string} [assertOptions.metric='p95'] - which stat to gate
     *   on: one of min, max, mean, stddev, p50, p95, p99.
     * @throws {RegressionError} when any case regresses past `pct`.
     * @returns {Promise<{ label: string, metric: string, threshold: number,
     *   results: Array<object> }>} summary when the assertion passes.
     */
    async toRegressNoMoreThan(pct, assertOptions = {}) {
      assertThreshold(pct);
      const {
        baselineFile = DEFAULT_BASELINE_FILE,
        historyFile,
        name,
        metric = DEFAULT_METRIC,
      } = assertOptions;
      assertMetric(metric);

      const label = name || fn.name || 'benchmark';
      const runResults = await benchmark(fn, cases, { warmup, iterations });
      const summarized = summarize(runResults);

      const entries = [];
      for (const { name: caseName, stats } of summarized) {
        const key = name ? `${name}:${caseName}` : caseName;
        if (historyFile) {
          appendHistory(historyFile, key, stats);
        }
        const baseline = loadBaseline(baselineFile, key);

        if (baseline === undefined) {
          saveBaseline(baselineFile, key, stats);
          entries.push({
            case: caseName,
            status: 'baseline-created',
            metric,
            current: stats[metric],
          });
          continue;
        }

        const delta = diffStats(stats, baseline)[metric];
        const status = delta.percent > pct ? 'regressed' : 'ok';
        entries.push({
          case: caseName,
          status,
          metric,
          current: delta.current,
          baseline: delta.baseline,
          percent: delta.percent,
          threshold: pct,
        });
      }

      const failures = entries.filter((entry) => entry.status === 'regressed');
      if (failures.length > 0) {
        throw new RegressionError(buildReport(label, failures), entries);
      }

      return { label, metric, threshold: pct, results: entries };
    },
  };
}

module.exports = { expectBenchmark, RegressionError };
