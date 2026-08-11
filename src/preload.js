const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  setInteractive: (isInteractive) => {
    ipcRenderer.send('pet:set-interactive', Boolean(isInteractive));
  },
  beginDrag: (point) => ipcRenderer.send('pet:drag-start', point),
  moveDrag: (point) => ipcRenderer.send('pet:drag-move', point),
  endDrag: () => ipcRenderer.send('pet:drag-end'),
  showMenu: () => ipcRenderer.send('pet:show-menu'),
  interact: (action) => ipcRenderer.invoke('pet:interact', action),
  recordEcologyInteraction: (kind) => ipcRenderer.send('ecology:interaction', kind),
  getCharacterProfile: () => ipcRenderer.invoke('character:get-renderer-profile'),
  getUiSettings: () => ipcRenderer.invoke('settings:get'),
  getBehaviorState: () => ipcRenderer.invoke('behavior:get-state'),
  reportAnimationState: (snapshot) => ipcRenderer.send('pet:animation-state', snapshot),
  onBehaviorState: (listener) => {
    ipcRenderer.on('behavior:state-changed', (_event, state) => listener(state));
  },
  onNotice: (listener) => {
    ipcRenderer.on('pet:notice', (_event, message) => listener(message));
  },
  onEcologyBubble: (listener) => {
    ipcRenderer.on('ecology:local-bubble', (_event, message) => listener(message));
  },
  onInteractionResponse: (listener) => {
    ipcRenderer.on('pet:interaction-response', (_event, reaction) => listener(reaction));
  },
  onUiSettingsChanged: (listener) => {
    ipcRenderer.on('settings:state-changed', (_event, state) => listener(state));
  }
});
