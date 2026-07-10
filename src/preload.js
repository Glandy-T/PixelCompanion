const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  setInteractive: (isInteractive) => {
    ipcRenderer.send('pet:set-interactive', Boolean(isInteractive));
  },
  beginDrag: (point) => ipcRenderer.send('pet:drag-start', point),
  moveDrag: (point) => ipcRenderer.send('pet:drag-move', point),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  showMenu: () => ipcRenderer.send('pet:show-menu'),
  getRuntimeConfig: () => ipcRenderer.invoke('app:get-runtime-config'),
  getBehaviorState: () => ipcRenderer.invoke('behavior:get-state'),
  getEnvironmentState: () => ipcRenderer.invoke('environment:get-state'),
  requestBehavior: (state) => ipcRenderer.send('behavior:debug-request', state),
  onBehaviorState: (listener) => {
    ipcRenderer.on('behavior:state-changed', (_event, state) => listener(state));
  },
  onEnvironmentState: (listener) => {
    ipcRenderer.on('environment:state-changed', (_event, state) => listener(state));
  },
  onNotice: (listener) => {
    ipcRenderer.on('pet:notice', (_event, message) => listener(message));
  }
});
