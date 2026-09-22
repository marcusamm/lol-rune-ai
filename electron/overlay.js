// The in-game build overlay: a frameless, transparent, always-on-top
// window that sits over the running game and shows what to buy next.
//
// It only exists while a game is actually in progress - created when the
// Live Client Data API starts responding, destroyed when it stops.

const { BrowserWindow, screen } = require('electron');
const path = require('path');

let overlayWindow = null;

function createOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 300,
    height: 420,
    x: width - 320,
    y: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false, // never steals focus from the game
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlayPreload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Above fullscreen game windows, not just other app windows.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

function destroyOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
  overlayWindow = null;
}

function sendToOverlay(channel, payload) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, payload);
  }
}

function isOpen() {
  return Boolean(overlayWindow && !overlayWindow.isDestroyed());
}

module.exports = { createOverlay, destroyOverlay, sendToOverlay, isOpen };
