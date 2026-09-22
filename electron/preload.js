const { contextBridge, ipcRenderer } = require('electron');
const { BACKEND_URL } = require('./config');

contextBridge.exposeInMainWorld('runeAI', {
  backendUrl: BACKEND_URL,
  onStatus: (cb) => ipcRenderer.on('status', (_e, msg) => cb(msg)),
  onDatasetLoaded: (cb) => ipcRenderer.on('dataset-loaded', (_e, info) => cb(info)),
  onClientStatus: (cb) => ipcRenderer.on('client-status', (_e, connected) => cb(connected)),
  onChampSelectStatus: (cb) => ipcRenderer.on('champ-select-status', (_e, s) => cb(s)),
  onRecommendation: (cb) => ipcRenderer.on('recommendation', (_e, payload) => cb(payload)),
  onApplied: (cb) => ipcRenderer.on('applied', (_e, payload) => cb(payload)),
  onItemSetApplied: (cb) => ipcRenderer.on('item-set-applied', (_e, payload) => cb(payload)),
  onWatcherError: (cb) => ipcRenderer.on('watcher-error', (_e, msg) => cb(msg)),
  onFatalError: (cb) => ipcRenderer.on('fatal-error', (_e, msg) => cb(msg)),
  setAutoApply: (value) => ipcRenderer.invoke('set-auto-apply', value),
  refreshDataset: () => ipcRenderer.invoke('refresh-dataset'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
});
