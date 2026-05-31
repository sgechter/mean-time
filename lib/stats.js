// Pure functions for session statistics. No Electron / no DOM — unit-testable.

// A session has:
//   startedAt: epoch ms
//   endedAt:   epoch ms | null
//   interruptions: Array<{ startedAt, endedAt | null }>

function totalElapsedMs(session, now) {
  const end = session.endedAt ?? now;
  return Math.max(0, end - session.startedAt);
}

function interruptedMs(session, now) {
  let total = 0;
  for (const i of session.interruptions) {
    const end = i.endedAt ?? now;
    total += Math.max(0, end - i.startedAt);
  }
  return total;
}

function workingMs(session, now) {
  return Math.max(0, totalElapsedMs(session, now) - interruptedMs(session, now));
}

// MTBI = mean working-time gap between the start of one interruption and the start of the next.
// We measure working-time (not wall-clock) gaps so that a long interruption doesn't get counted
// as "a long gap of productive work between interruptions."
//
// For N interruptions, there are N gaps:
//   - the gap from session start (working time) to interruption 1
//   - the gap of working time between interruption k and interruption k+1
//   ...and the final partial gap from the last interruption to "now" is NOT included
//   (it isn't yet a completed run between two interruptions).
//
// If 0 interruptions: undefined (no data yet).
// If 1 interruption and session still going: returns the single gap from start to that interruption.
function meanTimeBetweenInterruptionsMs(session, now) {
  const ints = session.interruptions;
  if (ints.length === 0) return null;

  const gaps = [];
  let cursor = session.startedAt;
  let interruptedSoFar = 0;

  for (let k = 0; k < ints.length; k++) {
    const i = ints[k];
    // wall-clock gap from cursor to interruption start
    const wallGap = i.startedAt - cursor;
    // subtract any interrupted time that fell inside this wall gap
    // (only relevant when interruptions overlap, which we don't allow — but keep correct)
    const gap = Math.max(0, wallGap);
    gaps.push(gap);
    cursor = i.startedAt;
    interruptedSoFar += (i.endedAt ?? now) - i.startedAt;
    // advance cursor past the interruption so the NEXT gap measures only working time
    cursor = (i.endedAt ?? now);
  }

  // Don't include the trailing partial gap — it isn't bounded by a second interruption.
  const sum = gaps.reduce((a, b) => a + b, 0);
  return sum / gaps.length;
}

function formatDuration(ms) {
  if (ms == null || !isFinite(ms)) return '--';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

module.exports = {
  totalElapsedMs,
  interruptedMs,
  workingMs,
  meanTimeBetweenInterruptionsMs,
  formatDuration,
};
