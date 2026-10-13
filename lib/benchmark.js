'use strict';

const { performance } = require('node:perf_hooks');

function normalizeCases(cases) {
  if (Array.isArray(cases)) {
    return cases.map((entry, index) => {
      if (entry && typeof entry === 'object' && 'input' in entry) {
        return { name: entry.name ?? String(index), input: entry.input };
      }
      return { name: String(index), input: entry };
    });
  }
  if (cases && typeof cases === 'object') {
    return Object.entries(cases).map(([name, input]) => ({ name, input }));
  }
  throw new TypeError('cases must be an array or an object of named fixtures');
}

async function runOnce(fn, input) {
  const start = performance.now();
  await fn(input);
  return performance.now() - start;
}

/**
 * Runs `fn` against each fixture in `cases`, timing every call with
 * perf_hooks, and returns the raw per-call sample durations (in
 * milliseconds) for each case.
 *
 * @param {Function} fn - function under test; receives one fixture input
 *   and may return a value synchronously or a Promise.
 * @param {Array|Object} cases - fixture inputs. Either an array of plain
 *   values, an array of `{ name, input }` entries, or an object mapping
 *   case name to input.
 * @param {Object} [options]
 * @param {number} [options.warmup=10] - calls run and discarded before
 *   timed iterations begin, per case.
 * @param {number} [options.iterations=100] - timed calls recorded per case.
 * @returns {Promise<Array<{ name: string, samples: number[] }>>}
 */
async function benchmark(fn, cases, options = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  const { warmup = 10, iterations = 100 } = options;
  if (!Number.isInteger(warmup) || warmup < 0) {
    throw new TypeError('options.warmup must be a non-negative integer');
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new TypeError('options.iterations must be a positive integer');
  }

  const normalized = normalizeCases(cases);
  if (normalized.length === 0) {
    throw new TypeError('cases must contain at least one fixture');
  }

  const results = [];
  for (const { name, input } of normalized) {
    for (let i = 0; i < warmup; i++) {
      await fn(input);
    }

    const samples = new Array(iterations);
    for (let i = 0; i < iterations; i++) {
      samples[i] = await runOnce(fn, input);
    }

    results.push({ name, samples });
  }

  return results;
}

module.exports = { benchmark };
