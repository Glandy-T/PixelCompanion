const { app, BrowserWindow, ipcMain, Menu, powerMonitor } = require('electron');
const path = require('path');
const { BehaviorEngine } = require('./core/behavior-engine');
const { EventBus, createEvent } = require('./core/event-bus');
const { StateStore } = require('./core/state-store');
const { ForegroundAppSensor } = require('./sensors/foreground-app-sensor');
const { IdleSensor } = require('./sensors/idle-sensor');
const { SensorManager } = require('./sensors/sensor-manager');
const { BridgeManager, BRIDGE_STATE_UPDATED } = require('./bridges/bridge-manager');
const { BridgeBehaviorIntegration } = require('./bridges/bridge-behavior-integration');
const { ECOLOGY_LOCAL_BUBBLE, ECOLOGY_STATE_UPDATED, EcologyEngine } = require('./ecology/ecology-engine');

let petWindow;
let debugWindow;
let isMouseIgnored = false;
let dragOffset = null;
let behaviorEngine = null;
let environmentEventBus = null;
let sensorManager = null;
let bridgeManager = null;
let bridgeBehaviorIntegration = null;
let ecologyEngine = null;
let latestAnimationSnapshot = null;

function getPetWindow(webContents) {
  const window = BrowserWindow.fromWebContents(webContents);
  return window && !window.isDestroyed() ? window : null;
}

function setMousePassthrough(window, shouldIgnore) {
  if (!window || window.isDestroyed() || isMouseIgnored === shouldIgnore) {
    return;
  }

  window.setIgnoreMouseEvents(shouldIgnore, { forward: shouldIgnore });
  isMouseIgnored = shouldIgnore;
}

function isScreenPoint(point) {
  return Number.isFinite(point?.screenX) && Number.isFinite(point?.screenY);
}

function showPetMenu(window) {
  const items = [
    {
      label: 'Open ChatGPT',
      click: () => {
        window.webContents.send(
          'pet:notice',
          'Open ChatGPT is a placeholder: desktop app focus is not configured yet.'
        );
      }
    },
    {
      label: 'Hide Pet',
      click: () => window.hide()
    }
  ];

  if (!app.isPackaged) {
    items.push(
      { type: 'separator' },
      {
        label: 'Toggle Debug Window',
        click: () => toggleDebugWindow()
      }
    );
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  );

  const menu = Menu.buildFromTemplate(items);

  menu.popup({ window });
}

function sendToDebugWindow(channel, payload) {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send(channel, payload);
  }
}

function sendDebugSnapshot() {
  sendToDebugWindow('behavior:state-changed', behaviorEngine?.getSnapshot() ?? null);
  sendToDebugWindow('environment:state-changed', sensorManager?.getSnapshot() ?? null);
  sendToDebugWindow('animation:state-changed', latestAnimationSnapshot);
  sendToDebugWindow('bridge:state-changed', bridgeManager?.getSnapshot() ?? null);
  sendToDebugWindow('ecology:state-changed', ecologyEngine?.getSnapshot() ?? null);
}

function createDebugWindow() {
  if (app.isPackaged) {
    return;
  }

  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 500,
    height: 860,
    minWidth: 400,
    minHeight: 440,
    title: 'Pixel Companion Debug',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'debug', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  debugWindow.setMenuBarVisibility(false);
  debugWindow.loadFile(path.join(__dirname, 'debug', 'index.html'));
  debugWindow.once('ready-to-show', () => {
    if (!debugWindow || debugWindow.isDestroyed()) {
      return;
    }

    debugWindow.show();
    sendDebugSnapshot();
  });
  debugWindow.on('closed', () => {
    debugWindow = null;
  });
}

function toggleDebugWindow() {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.close();
    return;
  }

  createDebugWindow();
}

function createBehaviorRuntime(window) {
  const eventBus = new EventBus();
  const stateStore = new StateStore({ state: 'idle', priority: 0, sequence: 0 });
  const engine = new BehaviorEngine({ eventBus, stateStore });

  eventBus.on('behavior:state-changed', (event) => {
    if (!window.isDestroyed()) {
      window.webContents.send('behavior:state-changed', event.payload);
    }
    sendToDebugWindow('behavior:state-changed', event.payload);
  });

  engine.start();
  return { engine, eventBus };
}

function createEnvironmentRuntime(window, eventBus, engine) {
  const manager = new SensorManager({
    eventBus,
    behaviorEngine: engine,
    foregroundSensor: new ForegroundAppSensor(),
    idleSensor: new IdleSensor({ powerMonitor })
  });

  eventBus.on('environment.state.updated', (event) => {
    if (!window.isDestroyed()) {
      window.webContents.send('environment:state-changed', event.payload);
    }
    sendToDebugWindow('environment:state-changed', event.payload);
  });

  manager.start();
  return manager;
}

function createBridgeRuntime(eventBus, engine) {
  const manager = new BridgeManager({ eventBus });
  const behaviorIntegration = new BridgeBehaviorIntegration({ eventBus, behaviorEngine: engine });
  eventBus.on(BRIDGE_STATE_UPDATED, (event) => {
    sendToDebugWindow('bridge:state-changed', event.payload);
  });
  behaviorIntegration.start();
  manager.start();
  return { manager, behaviorIntegration };
}

function createEcologyRuntime(eventBus) {
  const engine = new EcologyEngine({ eventBus });
  eventBus.on(ECOLOGY_STATE_UPDATED, (event) => {
    sendToDebugWindow('ecology:state-changed', event.payload);
  });
  eventBus.on(ECOLOGY_LOCAL_BUBBLE, (event) => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('ecology:local-bubble', event.payload.message);
    }
  });
  engine.start();
  return engine;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 256,
    height: 256,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow = window;
  const behaviorRuntime = createBehaviorRuntime(window);
  behaviorEngine = behaviorRuntime.engine;
  environmentEventBus = behaviorRuntime.eventBus;
  sensorManager = createEnvironmentRuntime(window, environmentEventBus, behaviorEngine);
  const bridgeRuntime = createBridgeRuntime(environmentEventBus, behaviorEngine);
  bridgeManager = bridgeRuntime.manager;
  bridgeBehaviorIntegration = bridgeRuntime.behaviorIntegration;
  ecologyEngine = createEcologyRuntime(environmentEventBus);
  window.setMenuBarVisibility(false);
  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  window.once('ready-to-show', () => {
    setMousePassthrough(window, true);
    window.show();
  });

  window.on('closed', () => {
    if (petWindow === window) {
      petWindow = null;
      dragOffset = null;
      isMouseIgnored = false;
      sensorManager?.stop();
      sensorManager = null;
      bridgeManager?.stop();
      bridgeManager = null;
      bridgeBehaviorIntegration?.stop();
      bridgeBehaviorIntegration = null;
      ecologyEngine?.stop();
      ecologyEngine = null;
      behaviorEngine?.stop();
      behaviorEngine = null;
      environmentEventBus = null;
      latestAnimationSnapshot = null;
      if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.close();
      }
    }
  });
}

ipcMain.on('pet:set-interactive', (event, isInteractive) => {
  const window = getPetWindow(event.sender);
  if (window) {
    setMousePassthrough(window, !Boolean(isInteractive));
  }
});

ipcMain.on('pet:drag-start', (event, point) => {
  const window = getPetWindow(event.sender);
  if (!window || !isScreenPoint(point)) {
    return;
  }

  const [windowX, windowY] = window.getPosition();
  dragOffset = {
    window,
    x: point.screenX - windowX,
    y: point.screenY - windowY
  };
  setMousePassthrough(window, false);
});

ipcMain.on('pet:drag-move', (event, point) => {
  const window = getPetWindow(event.sender);
  if (!window || dragOffset?.window !== window || !isScreenPoint(point)) {
    return;
  }

  window.setPosition(
    Math.round(point.screenX - dragOffset.x),
    Math.round(point.screenY - dragOffset.y)
  );
});

ipcMain.on('pet:drag-end', (event) => {
  const window = getPetWindow(event.sender);
  if (dragOffset?.window === window) {
    dragOffset = null;
  }
});

ipcMain.on('pet:show-menu', (event) => {
  const window = getPetWindow(event.sender);
  if (window) {
    showPetMenu(window);
  }
});

ipcMain.on('pet:animation-state', (event, snapshot) => {
  if (getPetWindow(event.sender) !== petWindow || !snapshot || typeof snapshot !== 'object') {
    return;
  }

  latestAnimationSnapshot = snapshot;
  sendToDebugWindow('animation:state-changed', latestAnimationSnapshot);
});

ipcMain.handle('app:get-runtime-config', () => ({
  debugEnabled: !app.isPackaged
}));

ipcMain.handle('behavior:get-state', () => behaviorEngine?.getSnapshot() ?? null);
ipcMain.handle('environment:get-state', () => sensorManager?.getSnapshot() ?? null);
ipcMain.handle('bridge:get-state', () => bridgeManager?.getSnapshot() ?? null);
ipcMain.handle('ecology:get-state', () => ecologyEngine?.getSnapshot() ?? null);

ipcMain.handle('bridge:set-sqlite-enabled', (event, enabled) => {
  if (app.isPackaged || event.sender !== debugWindow?.webContents || !bridgeManager) {
    return bridgeManager?.getSnapshot() ?? null;
  }

  return bridgeManager.setSqliteObservationEnabled(Boolean(enabled));
});

ipcMain.on('ecology:interaction', (event, kind) => {
  if (getPetWindow(event.sender) === petWindow && typeof kind === 'string') {
    ecologyEngine?.recordInteraction(kind);
  }
});

ipcMain.handle('ecology:debug-action', (event, action) => {
  if (app.isPackaged || event.sender !== debugWindow?.webContents || typeof action !== 'string') {
    return ecologyEngine?.getSnapshot() ?? null;
  }

  return ecologyEngine?.debugAction(action) ?? null;
});

ipcMain.on('behavior:debug-request', (event, state) => {
  if (
    app.isPackaged ||
    event.sender !== debugWindow?.webContents ||
    typeof state !== 'string' ||
    !behaviorEngine
  ) {
    return;
  }

  behaviorEngine.request(createEvent('behavior:request', {
    source: 'debug-panel',
    payload: {
      state,
      force: true,
      reason: 'manual-debug-trigger'
    }
  }));
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
