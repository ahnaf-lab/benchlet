'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { benchmark } = require('../index');

test('runs the requested number of iterations per case and returns numeric samples', async () => {
  const calls = [];
  const results = await benchmark(
    (input) => {
      calls.push(input);
    },
    [1, 2],
    { warmup: 2, iterations: 5 }
  );

  assert.equal(results.length, 2);
  assert.equal(results[0].samples.length, 5);
  assert.equal(results[1].samples.length, 5);
  // 2 cases * (2 warmup + 5 timed) = 14 total invocations
  assert.equal(calls.length, 14);
  for (const sample of results[0].samples) {
    assert.equal(typeof sample, 'number');
    assert.ok(sample >= 0);
  }
});

test('accepts named cases as an object and preserves names in results', async () => {
  const results = await benchmark(
    async (input) => input * 2,
    { small: 1, large: 1000 },
    { warmup: 0, iterations: 3 }
  );

  const names = results.map((r) => r.name);
  assert.deepEqual(names, ['small', 'large']);
  assert.equal(results[0].samples.length, 3);
});

test('passes each case input through to fn', async () => {
  const seen = [];
  await benchmark(
    (input) => {
      seen.push(input);
    },
    [{ name: 'a', input: 'alpha' }, { name: 'b', input: 'beta' }],
    { warmup: 0, iterations: 1 }
  );

  assert.deepEqual(seen, ['alpha', 'beta']);
});

test('measures a slower function with larger average samples than a faster one', async () => {
  const fast = () => 1 + 1;
  const slow = () => {
    let total = 0;
    for (let i = 0; i < 200000; i++) {
      total += i;
    }
    return total;
  };

  const [fastResult] = await benchmark(fast, [null], { warmup: 5, iterations: 20 });
  const [slowResult] = await benchmark(slow, [null], { warmup: 5, iterations: 20 });

  const avg = (samples) => samples.reduce((a, b) => a + b, 0) / samples.length;
  assert.ok(avg(slowResult.samples) > avg(fastResult.samples));
});

test('rejects invalid arguments', async () => {
  await assert.rejects(() => benchmark('not a function', [1]), TypeError);
  await assert.rejects(() => benchmark(() => {}, []), TypeError);
  await assert.rejects(() => benchmark(() => {}, [1], { iterations: 0 }), TypeError);
  await assert.rejects(() => benchmark(() => {}, [1], { warmup: -1 }), TypeError);
});
