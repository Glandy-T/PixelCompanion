const { pathToFileURL } = require('node:url');

function matchesLocalPage(url, filePath) {
  try {
    const actual = new URL(url);
    const expected = new URL(pathToFileURL(filePath).href);
    return actual.protocol === 'file:' && actual.host === expected.host && actual.pathname === expected.pathname;
  } catch { return false; }
}

function isTrustedSender(event, window, filePath) {
  return Boolean(window && !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame && event.senderFrame === window.webContents.mainFrame &&
    matchesLocalPage(event.senderFrame.url, filePath));
}

function protectWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-redirect', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}

module.exports = { matchesLocalPage, isTrustedSender, protectWindow };
