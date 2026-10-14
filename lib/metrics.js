'use strict';

/**
 * The set of stat metrics tracked throughout benchlet: baseline diffing,
 * regression assertions, and the sparkline reporter all gate on one of
 * these names.
 */
const METRICS = ['min', 'max', 'mean', 'stddev', 'p50', 'p95', 'p99'];

module.exports = { METRICS };
