const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localMysqlBridge', {
  saveConnectionConfig: (config) => ipcRenderer.send('save-connection-config', config),
});
