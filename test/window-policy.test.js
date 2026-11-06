const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isTrustedSender, matchesLocalPage, protectWindow } = require('../src/security/window-policy');

test('IPC allows only the expected local page in the owning main frame', () => {
  const file = path.resolve('src/renderer/index.html');
  const frame = { url: `${pathToFileURL(file).href}?renderer=3d` };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }, window, file), true);
  assert.equal(isTrustedSender({ sender: contents, senderFrame: { ...frame } }, window, file), false);
  assert.equal(isTrustedSender({ sender: {}, senderFrame: frame }, window, file), false);
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }, null, file), false);
  frame.url = 'https://example.invalid/index.html';
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }, window, file), false);
  assert.equal(matchesLocalPage(pathToFileURL(path.resolve('src/debug/index.html')).href, file), false);
});

test('window policy denies popup, navigation, redirect and webview attachment', () => {
  const events = new Map();
  let openHandler;
  protectWindow({ webContents: { setWindowOpenHandler: fn => { openHandler = fn; }, on: (type, fn) => events.set(type, fn) } });
  assert.deepEqual(openHandler(), { action: 'deny' });
  for (const type of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
    let prevented = false;
    events.get(type)({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
});
