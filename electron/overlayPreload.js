const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onUpdate: (cb) => ipcRenderer.on('overlay-update', (_e, payload) => cb(payload)),
});
