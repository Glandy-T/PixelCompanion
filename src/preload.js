const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  setInteractive: (isInteractive) => {
    ipcRenderer.send('pet:set-interactive', Boolean(isInteractive));
  },
  beginDrag: (point) => ipcRenderer.send('pet:drag-start', point),
  moveDrag: (point) => ipcRenderer.send('pet:drag-move', point),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  showMenu: () => ipcRenderer.send('pet:show-menu'),
  onNotice: (listener) => {
    ipcRenderer.on('pet:notice', (_event, message) => listener(message));
  }
});
