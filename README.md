# benchlet

A zero-dependency Node library you import directly into your test suite to
micro-benchmark any function — especially agent tool handlers and MCP tool
calls — against recorded fixture inputs. It tracks p50/p95/p99 latency and
asserts regression thresholds in CI, and ships a terminal sparkline report
so a slowdown shows up as a shape, not just a number.

The core timer runs a function against a set of fixture inputs and returns
the raw per-call latency samples, measured with Node's built-in
`perf_hooks`. On top of that, `computeStats()` and `summarize()` turn raw
samples into deterministic p50/p95/p99 percentiles, mean, and standard
deviation. A local JSON baseline store (`saveBaseline()` / `loadBaseline()`)
persists those stats per named benchmark and `compareToBaseline()` computes
the delta against the last recorded run. `expectBenchmark()` ties the timer,
stats, and baseline store together into a single CI-friendly assertion:
it throws a readable `RegressionError` when latency regresses past a
threshold. The sparkline reporter is not implemented yet.

## Install

```bash
npm install benchlet
```

No external packages are pulled in — the library only uses Node's standard
library (`perf_hooks`).

## Usage

```js
const { benchmark } = require('benchlet');

async function handleToolCall(input) {
  // your agent tool handler or MCP tool call
  return doWork(input);
}

const results = await benchmark(
  handleToolCall,
  [
    { name: 'short-prompt', input: { text: 'hi' } },
    { name: 'long-prompt', input: { text: 'a'.repeat(5000) } },
  ],
  { warmup: 10, iterations: 100 }
);

for (const { name, samples } of results) {
  // samples is an array of per-call durations in milliseconds
  console.log(name, samples.length, 'samples');
}
```

`cases` can also be a plain array of inputs, or an object mapping a case
name to its input:

```js
await benchmark(fn, [input1, input2]);
await benchmark(fn, { caseA: input1, caseB: input2 });
```

`fn` may be synchronous or return a Promise; each call is awaited and timed
individually.

### Percentile stats

`summarize()` attaches computed stats to each benchmark result, and
`computeStats()` computes the same stats directly from a plain array of
samples:

```js
const { benchmark, summarize } = require('benchlet');

const results = await benchmark(handleToolCall, cases);
const summarized = summarize(results);

for (const { name, stats } of summarized) {
  console.log(name, `p50=${stats.p50}ms p95=${stats.p95}ms p99=${stats.p99}ms`);
}
```

`stats` is `{ count, min, max, mean, stddev, p50, p95, p99 }`. Percentiles
use linear interpolation between ranked samples (the same method numpy and
most statistics tools default to), so results are deterministic and
reproducible for a given sample set regardless of input order.

### Baseline store

`saveBaseline()` and `loadBaseline()` read and write a local JSON file
that holds the last recorded stats for each named benchmark, so you can
compare today's run against a committed baseline:

```js
const { benchmark, summarize, saveBaseline, compareToBaseline } = require('benchlet');

const BASELINE_FILE = '.benchlet-baseline.json';

const results = await benchmark(handleToolCall, cases);
const [{ name, stats }] = summarize(results);

const { baseline, delta } = compareToBaseline(BASELINE_FILE, name, stats);

if (delta) {
  console.log(name, `p95 changed by ${delta.p95.percent.toFixed(1)}%`);
} else {
  console.log(name, 'no baseline recorded yet');
}

// after reviewing the delta, record the current run as the new baseline
saveBaseline(BASELINE_FILE, name, stats);
```

`compareToBaseline()` returns `{ name, current, baseline, delta }`. When
no baseline has been recorded yet for that name, `baseline` and `delta`
are `null`. Otherwise `delta` is keyed by metric (`min`, `max`, `mean`,
`stddev`, `p50`, `p95`, `p99`), each with `{ current, baseline, absolute,
percent }` — `diffStats()` exposes this same comparison directly on two
stats objects, without touching the file system. The baseline file stores
one JSON object keyed by benchmark name, so multiple named benchmarks can
share a single file; writing a baseline only updates its own entry.

### Assertion API

`expectBenchmark()` runs the benchmark and returns an object with
`toRegressNoMoreThan(pct)`, which checks each case's current stats against
its recorded baseline and throws when the regression exceeds `pct` percent:

```js
const { expectBenchmark } = require('benchlet');

await expectBenchmark(handleToolCall, cases, { warmup: 10, iterations: 100 }).toRegressNoMoreThan(10, {
  baselineFile: '.benchlet-baseline.json',
  name: 'handleToolCall',
  metric: 'p95', // defaults to p95; also accepts min, max, mean, stddev, p50, p99
});
```

A case with no recorded baseline yet is never failed — its current stats
are saved as the new baseline, so the first run in a fresh checkout always
succeeds and establishes the numbers future runs are checked against.
Otherwise, once the chosen `metric` regresses by more than `pct` percent
versus the baseline, the call throws a `RegressionError` whose message is a
readable diff per failing case, e.g.:

```
Regression check failed for "handleToolCall":
  case "short-prompt" p95 regressed 42.3% (baseline 1.200ms -> current 1.708ms), exceeds threshold 10%
```

`RegressionError#diff` carries the same information as structured data —
an array of `{ case, status, metric, current, baseline, percent, threshold }`
entries, one per case — for custom reporting.

## Status

This project is built autonomously, one milestone at a time, and gated on
passing tests — each change only ships if its automated test suite passes.
