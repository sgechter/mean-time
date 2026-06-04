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
  if (ms == null || !isFinite(ms)) return '--';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

// Compact form for the history table: drop seconds once we're into hours.
function formatDurationCompact(ms) {
  if (ms == null || !isFinite(ms)) return '--';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

function shortDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (isYest) return `Yest ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
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
    workVal.textContent = '--';
    intVal.textContent = '--';
    mtbiVal.textContent = '--';
    countVal.textContent = '0';
    sessionBtn.textContent = 'Start Session';
    interruptBtn.textContent = 'Interruption';
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
    interruptBtn.textContent = 'Interruption';
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

const historyToggle = document.getElementById('historyToggle');
const historyPanel = document.getElementById('history');
const historyList = document.getElementById('historyList');
const COLLAPSED_H = 180;
const EXPANDED_H = 380;

async function renderHistory() {
  let sessions = [];
  try {
    sessions = await window.api.readHistory();
  } catch (e) {
    console.error('Failed to read history', e);
  }
  // newest first
  sessions = [...sessions].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  historyList.innerHTML = '';
  let totalWork = 0, totalInt = 0, totalCount = 0, gapSum = 0;
  for (const s of sessions) {
    const end = s.endedAt ?? s.startedAt;
    const work = workingMs(s, end);
    const intr = interruptedMs(s, end);
    const mtbi = meanTimeBetweenInterruptionsMs(s, end);
    const count = s.interruptions?.length ?? 0;
    totalWork += work;
    totalInt += intr;
    totalCount += count;
    if (mtbi != null) gapSum += mtbi * count;

    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `
      <span class="hist-when">${shortDate(s.startedAt)}</span>
      <span class="hist-work">${formatDurationCompact(work)}</span>
      <span class="hist-int">${formatDurationCompact(intr)}</span>
      <span class="hist-mtbi">${formatDurationCompact(mtbi)}</span>
      <span class="hist-count">${count}</span>
    `;
    historyList.appendChild(row);
  }

  const aggMtbi = totalCount > 0 ? gapSum / totalCount : null;
  const agg = document.getElementById('historyAgg');
  agg.querySelector('.hist-when').textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;
  agg.querySelector('.hist-work').textContent = formatDurationCompact(totalWork);
  agg.querySelector('.hist-int').textContent = formatDurationCompact(totalInt);
  agg.querySelector('.hist-mtbi').textContent = formatDurationCompact(aggMtbi);
  agg.querySelector('.hist-count').textContent = String(totalCount);
}

historyToggle.addEventListener('click', async () => {
  const open = !historyPanel.hidden ? false : true;
  historyPanel.hidden = !open;
  historyToggle.classList.toggle('open', open);
  await window.api.resizeWindow({ height: open ? EXPANDED_H : COLLAPSED_H });
  if (open) renderHistory();
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
