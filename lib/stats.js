'use strict';

function assertNumericSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError('samples must be a non-empty array of numbers');
  }
  for (const value of samples) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new TypeError('samples must contain only numbers');
    }
  }
}

/**
 * Linear-interpolation percentile over an already-sorted (ascending)
 * array, matching the common "linear" definition used by numpy and most
 * statistics tools: rank = p/100 * (n - 1), interpolated between the two
 * nearest ranked samples.
 *
 * @param {number[]} sorted - ascending-sorted samples.
 * @param {number} p - percentile in [0, 100].
 * @returns {number}
 */
function percentile(sorted, p) {
  const n = sorted.length;
  if (n === 1) {
    return sorted[0];
  }
  const rank = (p / 100) * (n - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function mean(samples) {
  return samples.reduce((acc, x) => acc + x, 0) / samples.length;
}

function stddev(samples, avg) {
  const variance =
    samples.reduce((acc, x) => acc + (x - avg) ** 2, 0) / samples.length;
  return Math.sqrt(variance);
}

/**
 * Computes deterministic descriptive statistics for a set of latency
 * samples: count, min, max, mean, population standard deviation, and the
 * p50/p95/p99 percentiles (linear-interpolation method).
 *
 * @param {number[]} samples - per-call latency samples, in any order.
 * @returns {{count: number, min: number, max: number, mean: number,
 *   stddev: number, p50: number, p95: number, p99: number}}
 */
function computeStats(samples) {
  assertNumericSamples(samples);

  const sorted = [...samples].sort((a, b) => a - b);
  const avg = mean(sorted);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: avg,
    stddev: stddev(sorted, avg),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

/**
 * Attaches computed stats to each `{ name, samples }` entry returned by
 * `benchmark()`.
 *
 * @param {Array<{ name: string, samples: number[] }>} results
 * @returns {Array<{ name: string, samples: number[], stats: object }>}
 */
function summarize(results) {
  if (!Array.isArray(results)) {
    throw new TypeError('results must be an array of { name, samples } entries');
  }
  return results.map(({ name, samples }) => ({
    name,
    samples,
    stats: computeStats(samples),
  }));
}

module.exports = { computeStats, summarize, percentile };
