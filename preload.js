const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveSession: (session) => ipcRenderer.invoke('history:append', session),
  readHistory: () => ipcRenderer.invoke('history:read'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  resizeWindow: (size) => ipcRenderer.invoke('window:resize', size),
});
