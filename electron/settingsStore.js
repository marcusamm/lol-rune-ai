// Persists user-facing app settings to a JSON file in userData, separate
// from the matchup dataset cache.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  launchOnStartup: false,
  minimizeToTray: true,
  defaultRegion: 'euw1',
  theme: 'hextech',
  notifyOnApply: true,
  autoAccept: false,
  autoItemSet: true,
};

function filePath(userDataDir) {
  return path.join(userDataDir, 'settings.json');
}

function loadSettings(userDataDir) {
  const file = filePath(userDataDir);
  if (!fs.existsSync(file)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(userDataDir, settings) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath(userDataDir), JSON.stringify(settings, null, 2));
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
