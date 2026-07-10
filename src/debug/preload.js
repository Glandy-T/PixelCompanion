const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('debug', {
  getBehaviorState: () => ipcRenderer.invoke('behavior:get-state'),
  getEnvironmentState: () => ipcRenderer.invoke('environment:get-state'),
  requestBehavior: (state) => ipcRenderer.send('behavior:debug-request', state),
  onBehaviorState: (listener) => {
    ipcRenderer.on('behavior:state-changed', (_event, state) => listener(state));
  },
  onEnvironmentState: (listener) => {
    ipcRenderer.on('environment:state-changed', (_event, state) => listener(state));
  },
  onAnimationState: (listener) => {
    ipcRenderer.on('animation:state-changed', (_event, state) => listener(state));
  }
});
