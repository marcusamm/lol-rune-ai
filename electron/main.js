const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const { MatchupWatcher } = require('../src/watcher');
const { loadEnv } = require('../src/env');
const { loadSettings, saveSettings } = require('./settingsStore');

loadEnv(); // pulls RIOT_API_KEY from repo-root .env for the backend child process

let mainWindow = null;
let tray = null;
let watcher = null;
let backendProcess = null;
let settings = null;

function applyStartupSetting() {
  app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup });
}

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
    width: 1000,
    height: 760,
    minWidth: 760,
    minHeight: 540,
    resizable: true,
    backgroundColor: '#0b0d12',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      // Sandbox mode restricts preload's require() to built-in modules
      // only, breaking our local ./config require - keep it off. This
      // app doesn't render untrusted web content, so the extra isolation
      // sandbox provides isn't buying us anything here.
      sandbox: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
    console.error('[preload error]', preloadPath, error);
  });
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`);
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of quitting - this is meant to sit in the
    // background for the whole time League is open. Respects the user's
    // "minimize to tray" setting: off means the window closing quits.
    if (!app.isQuitting && settings.minimizeToTray) {
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
    autoAccept: settings.autoAccept,
    autoItemSet: settings.autoItemSet,
  });

  watcher.on('queue-accepted', () => send('status', 'Queue auto-accepted.'));
  watcher.on('item-set-applied', (payload) => send('item-set-applied', payload));

  watcher.on('status', (msg) => send('status', msg));
  watcher.on('dataset-loaded', (info) => send('dataset-loaded', info));
  watcher.on('client-status', (connected) => send('client-status', connected));
  watcher.on('champ-select-status', (s) => send('champ-select-status', s));
  watcher.on('recommendation', (payload) => send('recommendation', payload));
  watcher.on('applied', (payload) => {
    send('applied', payload);
    if (settings.notifyOnApply && Notification.isSupported()) {
      new Notification({
        title: 'RuneAI',
        body: `Applied runes for ${payload.myChamp} vs ${payload.enemyChamp} (${payload.position})`,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      }).show();
    }
  });
  watcher.on('error', (err) => send('watcher-error', err.message));

  watcher.start().catch((err) => send('fatal-error', err.message));
}

ipcMain.handle('set-auto-apply', (_event, value) => {
  if (watcher) watcher.setAutoApply(value);
});

ipcMain.handle('refresh-dataset', async () => {
  if (watcher) await watcher.refreshDataset();
});

ipcMain.handle('get-settings', () => settings);

ipcMain.handle('set-setting', (_event, key, value) => {
  settings[key] = value;
  saveSettings(app.getPath('userData'), settings);
  if (key === 'launchOnStartup') applyStartupSetting();
  if (key === 'autoAccept' && watcher) watcher.setAutoAccept(value);
  if (key === 'autoItemSet' && watcher) watcher.setAutoItemSet(value);
  return settings;
});

app.whenReady().then(() => {
  settings = loadSettings(app.getPath('userData'));
  applyStartupSetting();
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
