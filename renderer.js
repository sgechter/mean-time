// Renderer logic. The stats library is inlined here because Electron's renderer
// with contextIsolation can't require() local modules without bundling.
// Keep this in sync with lib/stats.js (which exists for unit tests).

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
function meanTimeBetweenInterruptionsMs(session, now) {
  const ints = session.interruptions;
  if (ints.length === 0) return null;
  const gaps = [];
  let cursor = session.startedAt;
  for (const i of ints) {
    gaps.push(Math.max(0, i.startedAt - cursor));
    cursor = i.endedAt ?? now;
  }
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}
function formatDuration(ms) {
  if (ms == null || !isFinite(ms)) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

const app = document.getElementById('app');
const sessionBtn = document.getElementById('sessionBtn');
const interruptBtn = document.getElementById('interruptBtn');
const closeBtn = document.getElementById('close');
const workVal = document.getElementById('workVal');
const intVal = document.getElementById('intVal');
const mtbiVal = document.getElementById('mtbiVal');
const countVal = document.getElementById('countVal');

let session = null;
let tick = null;

function isInterrupted() {
  if (!session) return false;
  const last = session.interruptions[session.interruptions.length - 1];
  return last && last.endedAt == null;
}

function render() {
  if (!session) {
    workVal.textContent = '—';
    intVal.textContent = '—';
    mtbiVal.textContent = '—';
    countVal.textContent = '0';
    sessionBtn.textContent = 'Start Session';
    interruptBtn.textContent = 'Interrupt';
    interruptBtn.disabled = true;
    app.classList.remove('running', 'interrupted');
    return;
  }
  const now = Date.now();
  workVal.textContent = formatDuration(workingMs(session, now));
  intVal.textContent = formatDuration(interruptedMs(session, now));
  mtbiVal.textContent = formatDuration(meanTimeBetweenInterruptionsMs(session, now));
  countVal.textContent = String(session.interruptions.length);
  sessionBtn.textContent = 'End Session';
  interruptBtn.disabled = false;
  app.classList.add('running');
  if (isInterrupted()) {
    interruptBtn.textContent = 'Resume';
    app.classList.add('interrupted');
  } else {
    interruptBtn.textContent = 'Interrupt';
    app.classList.remove('interrupted');
  }
}

function startTicking() {
  if (tick) return;
  tick = setInterval(render, 250);
}
function stopTicking() {
  if (tick) clearInterval(tick);
  tick = null;
}

sessionBtn.addEventListener('click', async () => {
  if (!session) {
    session = { startedAt: Date.now(), endedAt: null, interruptions: [] };
    startTicking();
    render();
  } else {
    // End any active interruption first
    if (isInterrupted()) {
      session.interruptions[session.interruptions.length - 1].endedAt = Date.now();
    }
    session.endedAt = Date.now();
    try {
      await window.api.saveSession(session);
    } catch (e) {
      console.error('Failed to save session', e);
    }
    session = null;
    stopTicking();
    render();
  }
});

interruptBtn.addEventListener('click', () => {
  if (!session) return;
  if (isInterrupted()) {
    session.interruptions[session.interruptions.length - 1].endedAt = Date.now();
  } else {
    session.interruptions.push({ startedAt: Date.now(), endedAt: null });
  }
  render();
});

closeBtn.addEventListener('click', () => {
  if (session) {
    // Auto-save in-progress session before closing
    if (isInterrupted()) {
      session.interruptions[session.interruptions.length - 1].endedAt = Date.now();
    }
    session.endedAt = Date.now();
    window.api.saveSession(session).finally(() => window.api.closeWindow());
  } else {
    window.api.closeWindow();
  }
});

render();
