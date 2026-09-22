const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { MatchupWatcher } = require('../src/watcher');
const { loadEnv } = require('../src/env');

loadEnv(); // pulls RIOT_API_KEY from repo-root .env for the backend child process

let mainWindow = null;
let tray = null;
let watcher = null;
let backendProcess = null;

function startBackend() {
  backendProcess = fork(path.join(__dirname, '..', 'backend', 'server.js'), {
    env: process.env,
    silent: true,
  });
  backendProcess.stdout?.on('data', (d) => console.log(`[backend] ${d.toString().trim()}`));
  backendProcess.stderr?.on('data', (d) => console.error(`[backend] ${d.toString().trim()}`));
  backendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[backend] exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    resizable: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of quitting - this is meant to sit in the
    // background for the whole time League is open.
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('RuneAI');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow.show() },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', () => mainWindow.show());
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function startWatcher() {
  watcher = new MatchupWatcher({
    userDataDir: app.getPath('userData'),
    autoApply: true,
  });

  watcher.on('status', (msg) => send('status', msg));
  watcher.on('dataset-loaded', (info) => send('dataset-loaded', info));
  watcher.on('client-status', (connected) => send('client-status', connected));
  watcher.on('champ-select-status', (s) => send('champ-select-status', s));
  watcher.on('recommendation', (payload) => send('recommendation', payload));
  watcher.on('applied', (payload) => send('applied', payload));
  watcher.on('error', (err) => send('watcher-error', err.message));

  watcher.start().catch((err) => send('fatal-error', err.message));
}

ipcMain.handle('set-auto-apply', (_event, value) => {
  if (watcher) watcher.setAutoApply(value);
});

ipcMain.handle('refresh-dataset', async () => {
  if (watcher) await watcher.refreshDataset();
});

app.whenReady().then(() => {
  startBackend();
  createWindow();
  createTray();
  startWatcher();
});

app.on('window-all-closed', () => {
  // Tray keeps the app alive - don't quit on window close.
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) backendProcess.kill();
});
