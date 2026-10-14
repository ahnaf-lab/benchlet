#!/usr/bin/env node
'use strict';

const { loadHistory, listHistoryNames, DEFAULT_HISTORY_FILE } = require('../lib/history');
const { renderSparkline } = require('../lib/sparkline');
const { METRICS } = require('../lib/metrics');

const USAGE = `Usage: benchlet [options]

Renders recorded benchmark history as a terminal sparkline per percentile.

Options:
  -f, --file <path>    history JSON file to read (default: ${DEFAULT_HISTORY_FILE})
  -m, --metric <name>  stat to plot: ${METRICS.join(', ')} (default: p95)
  -n, --name <name>    only show this benchmark/case name
  -h, --help           show this help

History is recorded by passing a \`historyFile\` option to
\`expectBenchmark(...).toRegressNoMoreThan(pct, { historyFile })\`.
`;

function parseArgs(argv) {
  const options = { file: DEFAULT_HISTORY_FILE, metric: 'p95', name: null, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-f':
      case '--file':
        options.file = argv[++i];
        break;
      case '-m':
      case '--metric':
        options.metric = argv[++i];
        break;
      case '-n':
      case '--name':
        options.name = argv[++i];
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function renderLine(name, entries, metric) {
  const values = entries.map((entry) => entry.stats[metric]);
  const sparkline = renderSparkline(values);
  const latest = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    `${name.padEnd(24)} ${sparkline}  ${metric} latest=${formatMs(latest)} ` +
    `min=${formatMs(min)} max=${formatMs(max)} (n=${values.length})`
  );
}

function main(argv, { log = console.log, error = console.error } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    error(err.message);
    error(USAGE);
    return 1;
  }

  if (options.help) {
    log(USAGE);
    return 0;
  }

  if (!METRICS.includes(options.metric)) {
    error(`Unknown metric "${options.metric}". Expected one of: ${METRICS.join(', ')}`);
    return 1;
  }

  const names = options.name ? [options.name] : listHistoryNames(options.file);

  if (names.length === 0) {
    log(`No benchmark history recorded yet in ${options.file}.`);
    log('Record some by passing { historyFile } to toRegressNoMoreThan().');
    return 0;
  }

  let printed = 0;
  for (const name of names) {
    const entries = loadHistory(options.file, name);
    if (entries.length === 0) {
      continue;
    }
    log(renderLine(name, entries, options.metric));
    printed++;
  }

  if (printed === 0) {
    log(`No recorded history for "${options.name}" in ${options.file}.`);
  }

  return 0;
}

if (require.main === module) {
  const exitCode = main(process.argv.slice(2));
  process.exitCode = exitCode;
}

module.exports = { main, parseArgs, renderLine };
