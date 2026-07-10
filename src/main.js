const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let petWindow;
let isMouseIgnored = false;
let dragOffset = null;

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
  const menu = Menu.buildFromTemplate([
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
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  menu.popup({ window });
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
