'use strict';

const { benchmark } = require('./lib/benchmark');
const { computeStats, summarize, percentile } = require('./lib/stats');
const { loadBaseline, saveBaseline, diffStats, compareToBaseline } = require('./lib/baseline');
const { expectBenchmark, RegressionError } = require('./lib/expect');
const { appendHistory, loadHistory, listHistoryNames, DEFAULT_HISTORY_FILE } = require('./lib/history');
const { renderSparkline, BLOCKS } = require('./lib/sparkline');

module.exports = {
  benchmark,
  computeStats,
  summarize,
  percentile,
  loadBaseline,
  saveBaseline,
  diffStats,
  compareToBaseline,
  expectBenchmark,
  RegressionError,
  appendHistory,
  loadHistory,
  listHistoryNames,
  DEFAULT_HISTORY_FILE,
  renderSparkline,
  BLOCKS,
};
