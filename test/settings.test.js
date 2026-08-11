const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AppSettingsStore, normalizeAppSettings } = require('../src/settings/app-settings');

test('app settings preserve current behavior defaults and ignore unknown private fields', () => {
  assert.deepEqual(normalizeAppSettings(), { quickActionsEnabled: true, proactiveEcologyEnabled: true });
  assert.deepEqual(normalizeAppSettings({ quickActionsEnabled: false, secret: 'ignored' }), {
    quickActionsEnabled: false,
    proactiveEcologyEnabled: true
  });
});

test('app settings store is local-only and safely handles malformed state', () => {
  const files = new Map([['settings.json', '{bad json']]);
  const fileSystem = {
    existsSync: (filePath) => files.has(filePath),
    readFileSync: (filePath) => files.get(filePath),
    mkdirSync: () => {},
    writeFileSync: (filePath, contents) => files.set(filePath, contents)
  };
  const store = new AppSettingsStore({ filePath: 'settings.json', fileSystem });
  assert.equal(store.load().quickActionsEnabled, true);
  store.save({ quickActionsEnabled: false, proactiveEcologyEnabled: false, content: 'not stored' });
  assert.deepEqual(JSON.parse(files.get('settings.json')), {
    quickActionsEnabled: false,
    proactiveEcologyEnabled: false
  });
});

test('settings window exposes privacy facts and required local controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings', 'index.html'), 'utf8');
  assert.match(html, /id="quick-actions"/);
  assert.match(html, /id="proactive-ecology"/);
  assert.match(html, /id="always-on-top"/);
  assert.match(html, /id="launch-at-login"/);
  assert.match(html, /Content collection<\/dt><dd>disabled/);
  assert.match(html, /Network upload<\/dt><dd>disabled/);
});

test('proactive setting is applied to EcologyEngine rather than BehaviorEngine', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  const behaviorRuntime = mainSource.match(/function createBehaviorRuntime[\s\S]*?function createEnvironmentRuntime/)[0];
  const ecologyRuntime = mainSource.match(/function createEcologyRuntime[\s\S]*?function createRelationshipRuntime/)[0];
  assert.doesNotMatch(behaviorRuntime, /setPaused/);
  assert.match(ecologyRuntime, /engine\.setPaused\(!appSettings\.proactiveEcologyEnabled\)/);
});
