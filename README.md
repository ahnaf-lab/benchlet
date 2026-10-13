# benchlet

A zero-dependency Node library you import directly into your test suite to
micro-benchmark any function — especially agent tool handlers and MCP tool
calls — against recorded fixture inputs. It tracks p50/p95/p99 latency and
asserts regression thresholds in CI, and ships a terminal sparkline report
so a slowdown shows up as a shape, not just a number.

This milestone implements the core timer: a `benchmark()` call that runs a
function against a set of fixture inputs and returns the raw per-call
latency samples, measured with Node's built-in `perf_hooks`. Percentile
calculation, regression assertions, and the sparkline reporter are not
implemented yet.

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

## Status

This project is built autonomously, one milestone at a time, and gated on
passing tests — each change only ships if its automated test suite passes.
