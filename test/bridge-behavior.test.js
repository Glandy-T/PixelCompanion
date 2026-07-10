const test = require('node:test');
const assert = require('node:assert/strict');
const { BehaviorEngine } = require('../src/core/behavior-engine');
const { EventBus, createEvent } = require('../src/core/event-bus');
const { StateStore } = require('../src/core/state-store');
const { AI_BRIDGE_EVENTS, createBridgeEvent } = require('../src/bridges/bridge-events');
const { BridgeBehaviorIntegration } = require('../src/bridges/bridge-behavior-integration');

function createIntegration() {
  let now = 1000;
  const bus = new EventBus();
  const engine = new BehaviorEngine({
    eventBus: bus,
    stateStore: new StateStore({ state: 'idle', priority: 0, sequence: 0 }),
    now: () => now,
    random: () => 0,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {}
  });
  const integration = new BridgeBehaviorIntegration({ eventBus: bus, behaviorEngine: engine });
  integration.start();
  return {
    bus,
    engine,
    advance(milliseconds) {
      now += milliseconds;
    }
  };
}

test('ChatGPT foreground requests thinking with bridge source tracking', () => {
  const { bus, engine } = createIntegration();

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));

  assert.equal(engine.getSnapshot().state, 'thinking');
  assert.equal(engine.getSnapshot().source, 'chatgpt-bridge');
  assert.equal(engine.getSnapshot().triggerEventType, AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND);
});

test('ChatGPT background and repeated foreground do not repeatedly transition behavior', () => {
  const { bus, engine } = createIntegration();
  const transitions = [];
  bus.on('behavior:state-changed', (event) => transitions.push(event.payload.state));

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_BACKGROUND));

  assert.deepEqual(transitions, ['thinking']);
  assert.equal(engine.getSnapshot().state, 'thinking');
});

test('Codex process started does not imply working', () => {
  const { bus, engine } = createIntegration();

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_STARTED));

  assert.equal(engine.getSnapshot().state, 'idle');
  assert.notEqual(engine.getSnapshot().state, 'working');
});

test('Codex host started does not imply working', () => {
  const { bus, engine } = createIntegration();

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_HOST_STARTED));

  assert.equal(engine.getSnapshot().state, 'idle');
  assert.notEqual(engine.getSnapshot().state, 'working');
});

test('Codex stopped and reserved activity events do not imply success or working', () => {
  const { bus, engine } = createIntegration();

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_STOPPED));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_ACTIVITY_STARTED));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_ACTIVITY_UPDATED));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CODEX_ACTIVITY_STOPPED));

  assert.equal(engine.getSnapshot().state, 'idle');
  assert.notEqual(engine.getSnapshot().state, 'success');
});

test('high-priority behavior is not overridden by bridge behavior requests', () => {
  const { bus, engine } = createIntegration();

  engine.request(createEvent('behavior:request', {
    source: 'interaction',
    payload: { state: 'alert', force: true, reason: 'test-alert' }
  }));
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));

  assert.equal(engine.getSnapshot().state, 'alert');
  assert.equal(engine.getSnapshot().source, 'interaction');
});

test('bridge cooldown permits a new trigger only after its configured interval', () => {
  const { bus, engine, advance } = createIntegration();
  const transitions = [];
  bus.on('behavior:state-changed', (event) => transitions.push(event.payload.state));

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));
  advance(30000);
  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));

  assert.deepEqual(transitions, ['thinking', 'thinking']);
  assert.equal(engine.getSnapshot().triggerEventType, AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND);
});

test('last bridge trigger remains available after the behavior returns to idle', () => {
  const { bus, engine } = createIntegration();

  bus.emit(createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND));
  engine.transition('idle', { source: 'behavior-engine', reason: 'working:timeout' });

  assert.equal(engine.getSnapshot().state, 'idle');
  assert.equal(engine.getSnapshot().triggerEventType, null);
  assert.equal(engine.getSnapshot().lastTriggerEventType, AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND);
});
