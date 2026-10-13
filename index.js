'use strict';

const { benchmark } = require('./lib/benchmark');
const { computeStats, summarize, percentile } = require('./lib/stats');

module.exports = { benchmark, computeStats, summarize, percentile };
