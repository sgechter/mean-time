const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const userDataDir = path.join(
  app.getPath('appData'),
  'mean-time'
);
const historyPath = path.join(userDataDir, 'history.json');

function ensureHistoryFile() {
  fs.mkdirSync(userDataDir, { recursive: true });
  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, '[]', 'utf8');
  }
}

function readHistory() {
  ensureHistoryFile();
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

function appendHistory(session) {
  const all = readHistory();
  all.push(session);
  fs.writeFileSync(historyPath, JSON.stringify(all, null, 2), 'utf8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 280,
    height: 180,
    minWidth: 240,
    minHeight: 150,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile('index.html');
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
}

ipcMain.handle('history:append', (_evt, session) => {
  appendHistory(session);
  return true;
});

ipcMain.handle('history:read', () => readHistory());

ipcMain.handle('window:close', () => {
  app.quit();
});

ipcMain.handle('window:resize', (evt, { width, height }) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win) return;
  const [w, h] = win.getSize();
  win.setSize(width ?? w, height ?? h, false);
});

app.setName('mean-time');

app.whenReady().then(() => {
  if (app.dock) app.dock.show();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
