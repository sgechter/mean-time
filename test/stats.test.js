const test = require('node:test');
const assert = require('node:assert/strict');
const {
  totalElapsedMs,
  interruptedMs,
  workingMs,
  meanTimeBetweenInterruptionsMs,
  formatDuration,
} = require('../lib/stats');

const s = 1000;
const m = 60 * s;

test('no interruptions: working = total, MTBI = null', () => {
  const session = { startedAt: 0, endedAt: null, interruptions: [] };
  const now = 10 * m;
  assert.equal(totalElapsedMs(session, now), 10 * m);
  assert.equal(interruptedMs(session, now), 0);
  assert.equal(workingMs(session, now), 10 * m);
  assert.equal(meanTimeBetweenInterruptionsMs(session, now), null);
});

test('one completed interruption', () => {
  const session = {
    startedAt: 0,
    endedAt: null,
    interruptions: [{ startedAt: 5 * m, endedAt: 7 * m }],
  };
  const now = 10 * m;
  assert.equal(interruptedMs(session, now), 2 * m);
  assert.equal(workingMs(session, now), 8 * m);
  // single gap from start to first interruption = 5 min
  assert.equal(meanTimeBetweenInterruptionsMs(session, now), 5 * m);
});

test('two interruptions: MTBI averages working-time gaps', () => {
  const session = {
    startedAt: 0,
    endedAt: null,
    interruptions: [
      { startedAt: 4 * m, endedAt: 6 * m },   // gap1 = 4m (0 -> 4m working)
      { startedAt: 10 * m, endedAt: 11 * m }, // gap2 = 4m (6m -> 10m working)
    ],
  };
  const now = 15 * m;
  // MTBI = (4 + 4) / 2 = 4
  assert.equal(meanTimeBetweenInterruptionsMs(session, now), 4 * m);
});

test('active interruption (no endedAt yet)', () => {
  const session = {
    startedAt: 0,
    endedAt: null,
    interruptions: [{ startedAt: 8 * m, endedAt: null }],
  };
  const now = 10 * m;
  assert.equal(interruptedMs(session, now), 2 * m);
  assert.equal(workingMs(session, now), 8 * m);
});

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(45 * s), '45s');
  assert.equal(formatDuration(5 * m + 3 * s), '5m 03s');
  assert.equal(formatDuration(2 * 3600 * s + 7 * m + 9 * s), '2h 07m 09s');
  assert.equal(formatDuration(null), '—');
});
