'use strict';

const { benchmark } = require('./lib/benchmark');
const { computeStats, summarize, percentile } = require('./lib/stats');
const { loadBaseline, saveBaseline, diffStats, compareToBaseline } = require('./lib/baseline');

module.exports = {
  benchmark,
  computeStats,
  summarize,
  percentile,
  loadBaseline,
  saveBaseline,
  diffStats,
  compareToBaseline,
};
