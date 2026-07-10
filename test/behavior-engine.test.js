const test = require('node:test');
const assert = require('node:assert/strict');
const { BehaviorEngine } = require('../src/core/behavior-engine');
const { EventBus, createEvent } = require('../src/core/event-bus');
const { StateStore } = require('../src/core/state-store');

function createScheduler() {
  let nextId = 1;
  const callbacks = new Map();

  return {
    setTimeoutFn(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeoutFn(id) {
      callbacks.delete(id);
    },
    runNext() {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback();
    }
  };
}

function createEngine(options = {}) {
  let now = 1000;
  const scheduler = createScheduler();
  const bus = new EventBus();
  const store = new StateStore({ state: 'idle', priority: 0, sequence: 0 });
  const engine = new BehaviorEngine({
    eventBus: bus,
    stateStore: store,
    now: () => now,
    random: () => 0.8,
    ...scheduler,
    ...options
  });

  return {
    bus,
    engine,
    scheduler,
    advance(milliseconds) {
      now += milliseconds;
    }
  };
}

test('higher-priority behavior interrupts a lower-priority behavior', () => {
  const { engine } = createEngine();

  assert.equal(engine.request({ state: 'working' }).accepted, true);
  assert.equal(engine.getSnapshot().state, 'working');
  assert.equal(engine.request({ state: 'alert' }).accepted, true);
  assert.equal(engine.getSnapshot().state, 'alert');
  assert.deepEqual(engine.request({ state: 'thinking' }), { accepted: false, reason: 'lower-priority' });
});

test('cooldown suppresses duplicate events until their cooldown expires', () => {
  const { engine, advance } = createEngine();

  assert.equal(engine.request({ state: 'success' }).accepted, true);
  assert.equal(engine.request({ state: 'success' }).reason, 'cooldown');
  advance(1800);
  assert.equal(engine.request({ state: 'success' }).accepted, true);
});

test('temporary states return to idle when their timer expires', () => {
  const { engine, scheduler } = createEngine();

  engine.request({ state: 'success', durationMs: 20 });
  assert.equal(engine.getSnapshot().state, 'success');
  scheduler.runNext();
  assert.equal(engine.getSnapshot().state, 'idle');
});

test('event bus requests and idle variants use the unified event format', () => {
  const { bus, engine } = createEngine();
  engine.start();

  bus.emit(createEvent('behavior:request', {
    source: 'test',
    payload: { state: 'idle', force: true }
  }));

  assert.equal(engine.getSnapshot().state, 'idle');
  assert.equal(engine.getSnapshot().variant, 'idle-breathe');
  engine.stop();
});
