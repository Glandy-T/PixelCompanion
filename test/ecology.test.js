const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus, createEvent } = require('../src/core/event-bus');
const { DriveModel } = require('../src/ecology/drive-model');
const { EcologyEngine, ECOLOGY_OBSERVE_OPPORTUNITY } = require('../src/ecology/ecology-engine');
const { LocalMemory } = require('../src/ecology/local-memory');
const { ProactivePlanner } = require('../src/ecology/proactive-planner');
const { RandomSource } = require('../src/ecology/random-source');

function createEngine(options = {}) {
  let now = options.now ?? 0;
  const bus = new EventBus();
  const engine = new EcologyEngine({
    eventBus: bus,
    now: () => now,
    getHour: options.getHour ?? (() => 14),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    config: { tickIntervalMs: 1000, proactiveCooldownMs: 10000, randomSeed: 7, ...options.config }
  });
  engine.start();
  return {
    bus,
    engine,
    advance(milliseconds) {
      now += milliseconds;
      return now;
    }
  };
}

function context(overrides = {}) {
  return {
    now: 1000,
    drives: { energy: 0.6, curiosity: 0.5, attention: 0.5, socialDrive: 0.5, focus: 0.4, arousal: 0.3 },
    currentBehavior: { state: 'idle', priority: 0 },
    currentAppCategory: 'other',
    recentSwitchCount: 0,
    timePeriod: 'daytime',
    memory: { lastProactiveAt: null, wasDialogueRecent: () => false },
    ...overrides
  };
}

test('drive model clamps changes and avoids oversized jumps', () => {
  const drives = new DriveModel({ defaults: { energy: 0.5 }, maxDelta: 0.1 });
  drives.adjust({ energy: 2, curiosity: -2 });
  assert.equal(drives.getSnapshot().energy, 0.6);
  assert.equal(drives.getSnapshot().curiosity, 0.4);
  drives.adjust({ energy: 20 }, { allowLargeDelta: true });
  assert.equal(drives.getSnapshot().energy, 1);
});

test('late-night time decay lowers energy faster without forcing behavior', () => {
  const daytime = new DriveModel({ defaults: { energy: 0.8 } });
  const lateNight = new DriveModel({ defaults: { energy: 0.8 } });
  daytime.decay(60000, 'daytime');
  lateNight.decay(60000, 'late-night');
  assert.ok(lateNight.getSnapshot().energy < daytime.getSnapshot().energy);
});

test('user interactions and environment events update ecology drives', () => {
  const { bus, engine } = createEngine();
  const before = engine.getSnapshot().drives;
  engine.recordInteraction('double-click');
  const afterInteraction = engine.getSnapshot().drives;
  assert.ok(afterInteraction.attention > before.attention);
  assert.ok(afterInteraction.socialDrive > before.socialDrive);

  bus.emit(createEvent('environment.app.rapid-switching', { source: 'test', payload: {} }));
  const afterSwitch = engine.getSnapshot().drives;
  assert.ok(afterSwitch.arousal > afterInteraction.arousal);
  assert.ok(afterSwitch.curiosity > afterInteraction.curiosity);
});

test('local memory has a bounded FIFO capacity and stores no external content fields', () => {
  const memory = new LocalMemory({ capacity: 2 });
  memory.recordInteraction('single-click', 1);
  memory.recordInteraction('double-click', 2);
  memory.recordInteraction('single-click', 3);
  const snapshot = memory.getSnapshot();
  assert.equal(snapshot.recentUserInteractionCount, 2);
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'lastAiObservationAt', 'lastMeaningfulEnvironmentChangeAt', 'lastProactiveAt',
    'recentAppCategoryCount', 'recentAppSwitchCount', 'recentBehaviorStateCount',
    'recentLocalDialogueCount', 'recentProactiveActionCount', 'recentUserInteractionCount'
  ]);
});

test('planner enforces cooldown and high priority behavior protection', () => {
  const planner = new ProactivePlanner({ random: { next: () => 0.9 }, cooldownMs: 1000 });
  assert.equal(planner.evaluate(context({ memory: { lastProactiveAt: 500, wasDialogueRecent: () => false } })).reason, 'proactive-cooldown');
  assert.equal(planner.evaluate(context({ currentBehavior: { state: 'alert', priority: 80 } })).reason, 'high-priority-behavior');
});

test('high focus reduces interruption probability and high curiosity increases observe opportunity', () => {
  const planner = new ProactivePlanner({ random: { next: () => 0.5 } });
  const lowFocus = planner.getWeights(context({ drives: { ...context().drives, focus: 0.1, curiosity: 0.1 } }));
  const highFocus = planner.getWeights(context({ drives: { ...context().drives, focus: 0.9, curiosity: 0.1 } }));
  const highCuriosity = planner.getWeights(context({ drives: { ...context().drives, focus: 0.1, curiosity: 0.9 } }));
  assert.ok(highFocus['no-op'] > lowFocus['no-op']);
  assert.ok(highCuriosity['observe-opportunity'] > lowFocus['observe-opportunity']);
});

test('low energy raises animation-only weight and can select a sleepy candidate', () => {
  const planner = new ProactivePlanner({ random: { next: () => 0.6 } });
  const highEnergy = planner.getWeights(context({ drives: { ...context().drives, energy: 0.9 } }));
  const lowEnergyContext = context({ drives: { ...context().drives, energy: 0.1 } });
  const lowEnergy = planner.getWeights(lowEnergyContext);
  assert.ok(lowEnergy['animation-only'] > highEnergy['animation-only']);
  const decision = planner.evaluate(lowEnergyContext, { force: true });
  assert.equal(decision.type, 'animation-only');
  assert.equal(decision.behaviorState, 'sleepy');
});

test('seeded random sources are deterministic and local dialogue is deduplicated', () => {
  const first = new RandomSource({ seed: 123 });
  const second = new RandomSource({ seed: 123 });
  assert.deepEqual([first.next(), first.next(), first.next()], [second.next(), second.next(), second.next()]);

  const planner = new ProactivePlanner({ random: { next: () => 0.85 } });
  const decision = planner.evaluate(context({ memory: { lastProactiveAt: null, wasDialogueRecent: () => true } }), { force: true });
  assert.equal(decision.type, 'no-op');
  assert.equal(decision.reason, 'dialogue-dedupe');
});

test('observe opportunity emits only a safe summary payload', () => {
  const { bus, engine } = createEngine();
  const opportunities = [];
  bus.on(ECOLOGY_OBSERVE_OPPORTUNITY, (event) => opportunities.push(event.payload));
  engine.planner = new ProactivePlanner({ random: { next: () => 0.99 } });
  engine.drives.adjust({ curiosity: 0.4 });
  engine.evaluateProactive({ force: true });

  assert.equal(opportunities.length, 1);
  assert.deepEqual(Object.keys(opportunities[0]).sort(), [
    'activeDuration', 'appCategory', 'ecologyState', 'idleSeconds', 'recentSwitchCount', 'timePeriod'
  ]);
});

test('ecology tick can pause and resume without touching the DOM', () => {
  const { engine, advance } = createEngine();
  const before = engine.getSnapshot().drives.energy;
  engine.setPaused(true);
  engine.tick(advance(60000));
  assert.equal(engine.getSnapshot().drives.energy, before);
  engine.setPaused(false);
  engine.tick(advance(60000));
  assert.ok(engine.getSnapshot().drives.energy < before);
});
