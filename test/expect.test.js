'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { expectBenchmark, RegressionError, loadBaseline } = require('../index');

function tempBaselinePath() {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'benchlet-expect-')),
    'baseline.json'
  );
}

function constantTime(ms) {
  return () => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // busy-wait for a deterministic-ish duration
    }
  };
}

test('first run with no baseline creates one and does not throw', async () => {
  const baselineFile = tempBaselinePath();

  const summary = await expectBenchmark(constantTime(0), [1], {
    warmup: 1,
    iterations: 5,
  }).toRegressNoMoreThan(10, { baselineFile, name: 'warm-up-case' });

  assert.equal(summary.results[0].status, 'baseline-created');
  assert.ok(loadBaseline(baselineFile, 'warm-up-case:0'));
});

test('throws a RegressionError when a case regresses past the threshold', async () => {
  const baselineFile = tempBaselinePath();
  const name = 'slow-handler';

  // Establish a fast baseline.
  await expectBenchmark(constantTime(0), [1], {
    warmup: 1,
    iterations: 5,
  }).toRegressNoMoreThan(10, { baselineFile, name });

  // Re-run with an artificially slower function; should exceed a 10% threshold.
  await assert.rejects(
    () =>
      expectBenchmark(constantTime(5), [1], {
        warmup: 1,
        iterations: 5,
      }).toRegressNoMoreThan(10, { baselineFile, name }),
    (err) => {
      assert.ok(err instanceof RegressionError);
      assert.match(err.message, /slow-handler/);
      assert.match(err.message, /regressed/);
      assert.equal(err.diff[0].status, 'regressed');
      return true;
    }
  );
});

test('does not throw when the regression is within the threshold', async () => {
  const baselineFile = tempBaselinePath();
  const name = 'stable-handler';

  await expectBenchmark(constantTime(0), [1], {
    warmup: 1,
    iterations: 5,
  }).toRegressNoMoreThan(10, { baselineFile, name });

  const summary = await expectBenchmark(constantTime(0), [1], {
    warmup: 1,
    iterations: 5,
  }).toRegressNoMoreThan(10000, { baselineFile, name });

  assert.equal(summary.results[0].status, 'ok');
});

test('checks each case independently and only reports the regressed ones', async () => {
  const baselineFile = tempBaselinePath();
  const name = 'multi-case';
  const cases = { quick: 1, slow: 2 };

  const fn = (input) => {
    if (input === 2) {
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy-wait
      }
    }
  };

  await expectBenchmark(fn, cases, { warmup: 1, iterations: 5 }).toRegressNoMoreThan(
    10,
    { baselineFile, name }
  );

  const slowerFn = (input) => {
    const ms = input === 2 ? 15 : 0;
    const start = Date.now();
    while (Date.now() - start < ms) {
      // busy-wait
    }
  };

  await assert.rejects(
    () =>
      expectBenchmark(slowerFn, cases, { warmup: 1, iterations: 5 }).toRegressNoMoreThan(
        10,
        { baselineFile, name }
      ),
    (err) => {
      assert.ok(err instanceof RegressionError);
      const regressed = err.diff.filter((e) => e.status === 'regressed');
      assert.ok(regressed.some((e) => e.case === 'slow'));
      return true;
    }
  );
});

test('rejects invalid arguments', async () => {
  assert.throws(() => expectBenchmark('not a function', [1]), TypeError);

  const baselineFile = tempBaselinePath();
  await assert.rejects(
    () => expectBenchmark(() => {}, [1]).toRegressNoMoreThan(-5, { baselineFile }),
    TypeError
  );
  await assert.rejects(
    () =>
      expectBenchmark(() => {}, [1]).toRegressNoMoreThan(10, {
        baselineFile,
        metric: 'bogus',
      }),
    TypeError
  );
});
