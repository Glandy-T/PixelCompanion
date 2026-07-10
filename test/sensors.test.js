const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/core/event-bus');
const { categorizeApp } = require('../src/sensors/app-category');
const { IdleSensor } = require('../src/sensors/idle-sensor');
const { PRIVACY_GUARANTEES, SensorManager } = require('../src/sensors/sensor-manager');

class FakeSensor {
  start(listener) {
    this.listener = listener;
  }

  stop() {
    this.listener = null;
  }

  emit(value) {
    this.listener(value);
  }
}

test('application categories use process names and fall back to other', () => {
  assert.equal(categorizeApp('ChatGPT.exe').category, 'conversation');
  assert.equal(categorizeApp('blender').category, 'creative-3d');
  assert.equal(categorizeApp('Code').category, 'development');
  assert.equal(categorizeApp('steam').category, 'leisure');
  assert.equal(categorizeApp('msedge.exe').category, 'browsing');
  assert.equal(categorizeApp('unknown-tool').category, 'other');
});

test('idle sensor derives active, idle, and long-idle from Electron idle time', () => {
  let idleSeconds = 10;
  const sensor = new IdleSensor({
    powerMonitor: { getSystemIdleTime: () => idleSeconds },
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  const observed = [];
  sensor.start((snapshot) => observed.push(snapshot));
  idleSeconds = 60;
  sensor.poll();
  idleSeconds = 300;
  sensor.poll();

  assert.deepEqual(observed.map((snapshot) => snapshot.state), ['active', 'idle', 'long-idle']);
  sensor.stop();
});

test('sensor manager emits environment events and maps sustained activity safely', () => {
  let now = 0;
  const eventBus = new EventBus();
  const foregroundSensor = new FakeSensor();
  const idleSensor = new FakeSensor();
  const requests = [];
  const manager = new SensorManager({
    eventBus,
    foregroundSensor,
    idleSensor,
    behaviorEngine: { request: (event) => requests.push(event) },
    now: () => now,
    activeAfterMs: 10,
    rapidSwitchCount: 4,
    rapidSwitchWindowMs: 1000
  });
  const observedEvents = [];
  eventBus.on('environment.app.changed', (event) => observedEvents.push(event.type));
  eventBus.on('environment.app.active', (event) => observedEvents.push(event.type));
  eventBus.on('environment.user.idle', (event) => observedEvents.push(event.type));
  manager.start();

  foregroundSensor.emit({ processName: 'Code.exe' });
  now = 11;
  foregroundSensor.emit({ processName: 'Code.exe' });
  idleSensor.emit({ idleSeconds: 301, state: 'long-idle' });
  now = 20;
  foregroundSensor.emit({ processName: 'Chrome.exe' });
  now = 30;
  foregroundSensor.emit({ processName: 'Steam.exe' });
  now = 40;
  foregroundSensor.emit({ processName: 'Blender.exe' });

  assert.deepEqual(observedEvents, [
    'environment.app.changed',
    'environment.app.active',
    'environment.user.idle',
    'environment.app.changed',
    'environment.app.changed',
    'environment.app.changed'
  ]);
  assert.deepEqual(requests.map((event) => event.payload.state), ['working', 'sleepy', 'alert']);
  assert.equal(manager.getSnapshot().currentCategory, 'creative-3d');
  assert.equal(manager.getSnapshot().idleSeconds, 301);
  manager.stop();
});

test('environment privacy guarantees exclude content collection and persistence', () => {
  assert.deepEqual(PRIVACY_GUARANTEES, {
    persistsToDisk: false,
    readsWindowTitle: false,
    readsInputContent: false,
    readsClipboard: false,
    capturesScreenshots: false,
    uploadsEnvironmentData: false
  });
});
