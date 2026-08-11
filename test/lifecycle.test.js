const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTrayMenuTemplate } = require('../src/lifecycle/tray-menu');
const {
  WindowPreferencesStore,
  normalizeWindowPreferences,
  resolveWindowPosition
} = require('../src/lifecycle/window-preferences');

test('window preferences keep only local position and always-on-top state', () => {
  assert.deepEqual(normalizeWindowPreferences({ x: 10.4, y: 20.6, alwaysOnTop: false, privateData: 'ignored' }), {
    x: 10,
    y: 21,
    alwaysOnTop: false
  });
});

test('window preference store falls back safely and writes only normalized data', () => {
  const files = new Map();
  const fileSystem = {
    existsSync: (filePath) => files.has(filePath),
    readFileSync: (filePath) => files.get(filePath),
    mkdirSync: () => {},
    writeFileSync: (filePath, contents) => files.set(filePath, contents)
  };
  const store = new WindowPreferencesStore({ filePath: 'C:\\local\\window-preferences.json', fileSystem });
  assert.equal(store.load().alwaysOnTop, true);
  store.save({ x: 45, y: 90, alwaysOnTop: false, secret: 'not stored' });
  assert.deepEqual(JSON.parse(files.get('C:\\local\\window-preferences.json')), { x: 45, y: 90, alwaysOnTop: false });
});

test('saved window positions survive valid displays and recover from disconnected monitors', () => {
  const displays = [
    { isPrimary: true, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { isPrimary: false, workArea: { x: 1920, y: 0, width: 1280, height: 1024 } }
  ];
  assert.deepEqual(resolveWindowPosition({ x: 2200, y: 300 }, displays), { x: 2200, y: 300 });
  assert.deepEqual(resolveWindowPosition({ x: 5000, y: 300 }, displays), { x: 1640, y: 760 });
  assert.equal(resolveWindowPosition({ x: null, y: null }, displays), null);
});

test('tray menu toggles visibility and keeps lifecycle controls separate', () => {
  let toggled = 0;
  const menu = buildTrayMenuTemplate({
    petVisible: false,
    alwaysOnTop: true,
    launchAtLoginAvailable: true,
    launchAtLogin: false,
    debugEnabled: true,
    onTogglePet: () => { toggled += 1; }
  });
  assert.equal(menu[0].label, 'Show Pet');
  menu[0].click();
  assert.equal(toggled, 1);
  assert.equal(menu.find((item) => item.label === 'Always on Top').checked, true);
  assert.equal(menu.find((item) => item.label === 'Launch at Login').checked, false);
  assert.ok(menu.some((item) => item.label === 'Toggle Debug Window'));
  assert.equal(menu.at(-1).label, 'Quit');
});
