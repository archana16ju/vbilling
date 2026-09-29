const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.on('update-not-available', (_event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', (_event, progressObj) => callback(progressObj));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  }
});
