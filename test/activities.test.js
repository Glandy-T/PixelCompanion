const test = require('node:test');
const assert = require('node:assert/strict');
const { ActivityRegistry } = require('../src/activities/activity-registry');
const { ActivityEngine } = require('../src/activities/activity-engine');
const { BehaviorEngine } = require('../src/core/behavior-engine');
const { StateStore } = require('../src/core/state-store');
const { EventBus, createEvent } = require('../src/core/event-bus');

function setup() {
  let now = 0;
  const bus = new EventBus();
  const behavior = new BehaviorEngine({ eventBus: bus, stateStore: new StateStore({}), now: () => now,
    setTimeoutFn: () => 1, clearTimeoutFn: () => {} });
  behavior.start();
  const activity = new ActivityEngine({ eventBus: bus, getBehaviorSnapshot: () => behavior.getSnapshot(), now: () => now,
    setIntervalFn: () => 1, clearIntervalFn: () => {} });
  activity.start();
  return { bus, behavior, activity, step(ms = 250) { now += ms; activity.tick(); },
    advance(ms) { for (let remaining = ms; remaining > 0; remaining -= 250) { now += Math.min(250, remaining); activity.tick(); } } };
}

test('registry isolates per-character definitions and rejects invalid plans', () => {
  const registry = new ActivityRegistry();
  const plan = registry.get('observe-demo');
  plan.steps[0].durationMs = 999;
  assert.equal(registry.get('observe-demo').steps[0].durationMs, 4000);
  assert.throws(() => new ActivityRegistry([{ id: 'bad', label: 'Bad', steps: [{ id: 'a', label: 'A', behavior: 'missing', durationMs: 1 }] }]));
  assert.equal(registry.get('missing'), null);
});

test('activity runs ordered steps and completes once without implying AI success', () => {
  const { bus, behavior, activity, advance } = setup();
  const events = [];
  bus.on('activity.completed', event => events.push(event));
  assert.equal(activity.getSnapshot().status, 'idle');
  assert.equal(activity.begin('observe-demo').accepted, true);
  assert.equal(behavior.getSnapshot().state, 'thinking');
  advance(4000);
  assert.equal(activity.getSnapshot().stepIndex, 1);
  assert.equal(behavior.getSnapshot().state, 'idle');
  advance(2000);
  assert.equal(activity.getSnapshot().status, 'completed');
  assert.equal(activity.getSnapshot().progress, 1);
  advance(1000);
  assert.equal(events.length, 1);
  assert.equal(behavior.getSnapshot().state, 'idle');
  assert.equal(activity.begin('observe-demo').reason, 'cooldown');
});

test('manual pause freezes elapsed time and resume continues same step', () => {
  const { activity, advance } = setup();
  activity.begin('observe-demo');
  advance(1000);
  activity.setBlocked('manual', true);
  advance(5000);
  assert.equal(activity.getSnapshot().elapsedMs, 1000);
  assert.equal(activity.getSnapshot().status, 'paused');
  activity.setBlocked('manual', false);
  advance(250); // resume does not count paused time
  advance(3000);
  assert.equal(activity.getSnapshot().elapsedMs, 4000);
  assert.equal(activity.getSnapshot().stepIndex, 1);
});

test('higher-priority behavior interrupts activity, remains protected and allows later resume', () => {
  const { bus, behavior, activity, advance } = setup();
  activity.begin('observe-demo');
  advance(1000);
  behavior.request(createEvent('behavior:request', { source: 'test-alert', payload: { state: 'alert' } }));
  advance(2000);
  assert.equal(activity.getSnapshot().status, 'paused');
  assert.equal(activity.getSnapshot().elapsedMs, 1000);
  assert.equal(behavior.getSnapshot().state, 'alert');
  bus.emit(createEvent('behavior:release', { source: 'test-alert', payload: { sequence: behavior.getSnapshot().sequence } }));
  advance(250);
  assert.equal(activity.getSnapshot().status, 'running');
  assert.equal(behavior.getSnapshot().source, 'activity-engine');
});

test('interaction and overlapping blockers cannot be resumed prematurely', () => {
  const { activity, advance } = setup();
  activity.begin('observe-demo');
  advance(500);
  activity.setBlocked('hidden', true);
  activity.setBlocked('dragging', true);
  activity.setBlocked('hidden', false);
  advance(1000);
  assert.equal(activity.getSnapshot().status, 'paused');
  activity.setBlocked('dragging', false);
  activity.interruptForInteraction();
  advance(1000);
  assert.equal(activity.getSnapshot().status, 'paused');
  advance(500);
  assert.equal(activity.getSnapshot().status, 'running');
  assert.equal(activity.getSnapshot().elapsedMs, 500);
});

test('cancel and stale owner releases never reset a foreign behavior', () => {
  const { bus, behavior, activity } = setup();
  activity.begin('observe-demo');
  const old = behavior.getSnapshot().sequence;
  behavior.request(createEvent('behavior:request', { source: 'external', payload: { state: 'waiting' } }));
  bus.emit(createEvent('behavior:release', { source: 'activity-engine', payload: { sequence: old } }));
  activity.cancel();
  assert.equal(behavior.getSnapshot().state, 'waiting');
  assert.equal(activity.getSnapshot().status, 'cancelled');
});

test('busy start is deferred and stop removes timers and subscriptions', () => {
  const { activity, behavior, advance } = setup();
  behavior.request({ state: 'alert' });
  assert.equal(activity.begin('observe-demo').accepted, true);
  assert.equal(activity.getSnapshot().status, 'paused');
  assert.equal(activity.begin('observe-demo').reason, 'busy');
  assert.equal(behavior.getSnapshot().state, 'alert');
  activity.stop();
  advance(1000);
  assert.equal(activity.getSnapshot().status, 'cancelled');
  assert.equal(activity.unsubscribers.length, 0);
  assert.equal(activity.timer, null);
  assert.equal(activity.begin('observe-demo').reason, 'not-running');
});
