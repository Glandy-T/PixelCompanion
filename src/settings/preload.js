const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  getState: () => ipcRenderer.invoke('settings:get'),
  update: (values) => ipcRenderer.invoke('settings:update', values),
  onStateChanged: (listener) => {
    ipcRenderer.on('settings:state-changed', (_event, state) => listener(state));
  }
});
