const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_PERSONALITY_TRAITS,
  PERSONALITY_TRAITS,
  clampPersonalityValue
} = require('../src/personality/personality-config');
const { PersonalityManager } = require('../src/personality/personality-manager');
const { PersonalityState } = require('../src/personality/personality-state');
const { EcologyEngine } = require('../src/ecology/ecology-engine');
const { EventBus } = require('../src/core/event-bus');

test('personality exposes the complete local trait set with safe defaults', () => {
  const state = new PersonalityState();
  assert.deepEqual(Object.keys(state.getTraits()), PERSONALITY_TRAITS);
  assert.deepEqual(state.getTraits(), DEFAULT_PERSONALITY_TRAITS);
  assert.equal(state.getSnapshot().state, 'ready');
});

test('personality setters clamp numeric and invalid values to the supported range', () => {
  const state = new PersonalityState();
  assert.equal(state.setTrait('warmth', 1.5), 1);
  assert.equal(state.setTrait('curiosity', -0.2), 0);
  assert.equal(state.setTrait('playfulness', '0.75'), 0.75);
  assert.equal(state.setTrait('confidence', Number.NaN), 0);
  assert.throws(() => state.setTrait('unknown', 0.5), /Unknown personality trait/);
});

test('personality manager provides state access and future-only ecology modifiers', () => {
  const manager = new PersonalityManager({ config: { defaultTraits: { curiosity: 0.8 } } });
  manager.setTraits({ warmth: 0.7, playfulness: 0.9 });
  assert.equal(manager.getTrait('curiosity'), 0.8);
  assert.equal(manager.getSnapshot().traits.warmth, 0.7);
  assert.deepEqual(manager.getEcologyModifiers(), {
    futureOnly: true,
    observeOpportunity: 0.8,
    randomInteraction: 0.9,
    localBubbleWarmth: 0.7,
    assertiveness: 0.5,
    caution: 0.45,
    restraint: 0.5
  });
});

test('ecology reports personality without using it to change existing planner behavior', () => {
  const personality = new PersonalityManager({ config: { defaultTraits: { curiosity: 1, playfulness: 1 } } });
  const engine = new EcologyEngine({
    eventBus: new EventBus(),
    personalityManager: personality,
    now: () => 0,
    getHour: () => 14,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {}
  });
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.personality.traits.curiosity, 1);
  assert.equal(snapshot.personalityModifiers.futureOnly, true);
  assert.equal(snapshot.personalityModifiers.observeOpportunity, 1);

  const plannerContext = {
    now: 0,
    drives: { energy: 0.6, curiosity: 0.1, attention: 0.5, socialDrive: 0.5, focus: 0.4, arousal: 0.3 },
    currentBehavior: { state: 'idle', priority: 0 },
    currentAppCategory: 'other',
    recentSwitchCount: 0,
    timePeriod: 'daytime',
    memory: { lastProactiveAt: null, wasDialogueRecent: () => false },
    personalityModifiers: snapshot.personalityModifiers
  };
  assert.deepEqual(engine.planner.getWeights(plannerContext), engine.planner.getWeights({ ...plannerContext, personalityModifiers: undefined }));
});

test('clamp helper is bounded for non-finite and out-of-range input', () => {
  assert.equal(clampPersonalityValue(-1), 0);
  assert.equal(clampPersonalityValue(2), 1);
  assert.equal(clampPersonalityValue(Infinity), 0);
});

test('development debug window includes the local personality state display', () => {
  const debugHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'debug', 'index.html'), 'utf8');
  const debugRenderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'debug', 'renderer.js'), 'utf8');
  for (const trait of PERSONALITY_TRAITS) {
    assert.match(debugHtml, new RegExp(`id="personality-${trait}"`));
  }
  assert.match(debugHtml, /id="personality-state"/);
  assert.match(debugRenderer, /applyPersonalityState\(snapshot\.personality\)/);
});
