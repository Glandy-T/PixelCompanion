const { createEvent } = require('../core/event-bus');
const { mergeEcologyConfig } = require('./ecology-config');
const { DriveModel } = require('./drive-model');
const { EcologyState } = require('./ecology-state');
const { EcologyTick } = require('./ecology-tick');
const { LocalMemory } = require('./local-memory');
const { ProactivePlanner } = require('./proactive-planner');
const { RandomSource } = require('./random-source');
const { PersonalityManager } = require('../personality/personality-manager');

const ECOLOGY_STATE_UPDATED = 'ecology:state.updated';
const ECOLOGY_LOCAL_BUBBLE = 'ecology.local-bubble';
const ECOLOGY_OBSERVE_OPPORTUNITY = 'ecology.observe.opportunity';
const ECOLOGY_PROACTIVE_DECISION = 'ecology.proactive.decision';

class EcologyEngine {
  constructor(options = {}) {
    if (!options.eventBus) {
      throw new Error('EcologyEngine requires an EventBus.');
    }

    this.eventBus = options.eventBus;
    this.config = mergeEcologyConfig(options.config);
    this.now = options.now ?? (() => Date.now());
    this.drives = new DriveModel({ defaults: this.config.defaultDrives, maxDelta: this.config.maxDriveDelta });
    this.state = new EcologyState({ now: this.now, getHour: options.getHour });
    this.memory = new LocalMemory({ capacity: this.config.memoryCapacity });
    this.random = options.random ?? new RandomSource({ mode: this.config.randomMode, seed: this.config.randomSeed });
    this.personality = options.personalityManager ?? new PersonalityManager({ config: options.personalityConfig });
    this.planner = options.planner ?? new ProactivePlanner({
      random: this.random,
      cooldownMs: this.config.proactiveCooldownMs,
      dialogueCooldownMs: this.config.dialogueCooldownMs
    });
    this.tickRunner = new EcologyTick({
      intervalMs: this.config.tickIntervalMs,
      onTick: () => this.tick(),
      setIntervalFn: options.setIntervalFn,
      clearIntervalFn: options.clearIntervalFn
    });
    this.unsubscribers = [];
    this.currentBehavior = { state: 'idle', priority: 0 };
    this.environment = { currentCategory: 'other', activeDurationMs: 0, idleSeconds: 0, recentSwitchCount: 0, userState: 'active' };
    this.lastEcologyEvent = null;
    this.lastDecision = null;
    this.started = false;
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.bindEvents();
    this.state.updateTime(this.now());
    this.tickRunner.start();
    this.publishState();
  }

  stop() {
    this.started = false;
    this.tickRunner.stop();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  bindEvents() {
    this.unsubscribers.push(
      this.eventBus.on('environment.state.updated', (event) => this.handleEnvironmentState(event.payload)),
      this.eventBus.on('environment.app.changed', (event) => this.handleAppChanged(event.payload)),
      this.eventBus.on('environment.app.rapid-switching', () => this.applyEffect('rapid-switching', { curiosity: 0.05, arousal: 0.08 })),
      this.eventBus.on('environment.user.idle', (event) => {
        if (event.payload.kind === 'long-idle') {
          this.applyEffect('long-idle', { energy: -0.07, attention: -0.02 });
        }
      }),
      this.eventBus.on('environment.user.active', () => this.applyEffect('user-active', { attention: 0.04 })),
      this.eventBus.on('behavior:state-changed', (event) => {
        this.currentBehavior = { state: event.payload.state, priority: event.payload.priority ?? 0 };
        this.memory.recordBehavior(event.payload.state, this.now());
        this.publishState();
      }),
      this.eventBus.on('ai.chatgpt.foreground', () => this.applyEffect('chatgpt-foreground', { attention: 0.04 }))
    );
  }

  tick(now = this.now()) {
    if (this.state.paused) {
      return this.getSnapshot();
    }

    const elapsedMs = Math.max(0, now - this.state.lastTickAt);
    const time = this.state.updateTime(now);
    this.drives.decay(elapsedMs, time.timePeriod);
    this.evaluateProactive();
    this.publishState();
    return this.getSnapshot();
  }

  handleEnvironmentState(snapshot) {
    this.environment = {
      currentCategory: snapshot.currentCategory ?? 'other',
      activeDurationMs: snapshot.activeDurationMs ?? 0,
      idleSeconds: snapshot.idleSeconds ?? 0,
      recentSwitchCount: snapshot.recentSwitches?.length ?? 0,
      userState: snapshot.userState ?? 'active'
    };
    if (this.environment.currentCategory === 'development' || this.environment.currentCategory === 'creative-3d') {
      this.applyEffect('focused-activity', { focus: 0.025, attention: 0.01 });
    }
  }

  handleAppChanged(payload) {
    const category = payload.category ?? 'other';
    const now = this.now();
    const seen = this.memory.getSnapshot().recentAppCategoryCount > 0;
    this.memory.recordAppCategory(category, now);
    this.memory.recordAppSwitch(category, now);
    this.environment.currentCategory = category;
    this.environment.recentSwitchCount += 1;
    this.applyEffect('app-changed', {
      curiosity: seen ? 0.01 : 0.045,
      arousal: 0.01
    });
  }

  recordInteraction(kind) {
    const now = this.now();
    this.memory.recordInteraction(kind, now);
    const recentCount = this.memory.recentInteractionCount(now - 5000);
    const deltas = kind === 'double-click'
      ? { attention: 0.07, socialDrive: 0.06 }
      : { attention: 0.035, socialDrive: 0.03 };
    if (recentCount >= 4) {
      deltas.arousal = 0.06;
    }
    this.applyEffect(`interaction:${kind}`, deltas);
  }

  applyEffect(name, deltas) {
    this.drives.adjust(deltas);
    this.lastEcologyEvent = { name, at: this.now() };
    this.publishState();
  }

  evaluateProactive(options = {}) {
    const now = this.now();
    const time = this.state.getTime();
    const memory = this.memory.getSnapshot();
    memory.wasDialogueRecent = (message, since) => this.memory.wasDialogueRecent(message, since);
    const decision = this.planner.evaluate({
      now,
      drives: this.drives.getSnapshot(),
      currentBehavior: this.currentBehavior,
      currentAppCategory: this.environment.currentCategory,
      recentSwitchCount: this.environment.recentSwitchCount,
      timePeriod: time.timePeriod,
      memory,
      // Reserved for future planner tuning. It is intentionally not consumed by
      // the current planner, so personality never changes existing behavior.
      personalityModifiers: this.personality.getEcologyModifiers()
    }, options);
    this.lastDecision = { ...decision, at: now };
    if (decision.type !== 'no-op') {
      this.memory.recordProactive(decision.type, now);
    }
    this.eventBus.emit(createEvent(ECOLOGY_PROACTIVE_DECISION, {
      source: 'ecology-engine',
      payload: { type: decision.type, reason: decision.reason }
    }));

    if (decision.type === 'animation-only') {
      this.eventBus.emit(createEvent('behavior:request', {
        source: 'ecology',
        payload: {
          state: decision.behaviorState,
          dedupeKey: `ecology:${decision.behaviorState}`,
          cooldownMs: this.config.proactiveCooldownMs,
          reason: decision.reason,
          triggerEventType: ECOLOGY_PROACTIVE_DECISION
        }
      }));
    } else if (decision.type === 'local-bubble') {
      this.memory.recordDialogue(decision.message, now);
      this.eventBus.emit(createEvent(ECOLOGY_LOCAL_BUBBLE, {
        source: 'ecology-engine',
        payload: { message: decision.message }
      }));
    } else if (decision.type === 'observe-opportunity') {
      this.memory.values.lastAiObservationAt = now;
      this.eventBus.emit(createEvent(ECOLOGY_OBSERVE_OPPORTUNITY, {
        source: 'ecology-engine',
        payload: {
          appCategory: this.environment.currentCategory,
          activeDuration: this.environment.activeDurationMs,
          idleSeconds: this.environment.idleSeconds,
          recentSwitchCount: this.environment.recentSwitchCount,
          ecologyState: this.drives.getSnapshot(),
          timePeriod: time.timePeriod
        }
      }));
    }

    this.publishState();
    return decision;
  }

  setPaused(paused) {
    this.state.setPaused(paused);
    this.publishState();
  }

  reset() {
    this.drives.reset(this.config.defaultDrives);
    this.random.reset(this.config.randomSeed);
    this.lastDecision = null;
    this.lastEcologyEvent = { name: 'reset', at: this.now() };
    this.publishState();
  }

  debugAction(action) {
    switch (action) {
      case 'simulate-tick':
        return this.tick(this.now() + this.config.tickIntervalMs);
      case 'raise-curiosity':
        this.applyEffect('debug:raise-curiosity', { curiosity: 0.1 });
        break;
      case 'lower-energy':
        this.applyEffect('debug:lower-energy', { energy: -0.1 });
        break;
      case 'simulate-long-idle':
        this.applyEffect('debug:long-idle', { energy: -0.07, attention: -0.02 });
        break;
      case 'simulate-rapid-switching':
        this.applyEffect('debug:rapid-switching', { curiosity: 0.05, arousal: 0.08 });
        break;
      case 'force-proactive-evaluation':
        this.evaluateProactive({ force: true });
        break;
      case 'reset-ecology':
        this.reset();
        break;
      case 'toggle-pause':
        this.setPaused(!this.state.paused);
        break;
      default:
        return this.getSnapshot();
    }
    return this.getSnapshot();
  }

  publishState() {
    this.eventBus.emit(createEvent(ECOLOGY_STATE_UPDATED, {
      source: 'ecology-engine',
      payload: this.getSnapshot()
    }));
  }

  getSnapshot() {
    const time = this.state.getTime();
    return {
      drives: this.drives.getSnapshot(),
      hourOfDay: time.hourOfDay,
      timePeriod: time.timePeriod,
      paused: this.state.paused,
      tick: { running: this.tickRunner.running, intervalMs: this.config.tickIntervalMs, healthy: true },
      environment: { ...this.environment },
      currentBehavior: { ...this.currentBehavior },
      memory: this.memory.getSnapshot(),
      lastEcologyEvent: this.lastEcologyEvent,
      lastProactiveDecision: this.lastDecision,
      proactiveCooldownMs: this.config.proactiveCooldownMs,
      lastObserveOpportunity: this.memory.values.lastAiObservationAt,
      random: this.random.getSnapshot(),
      personality: this.personality.getSnapshot(),
      personalityModifiers: this.personality.getEcologyModifiers()
    };
  }
}

module.exports = {
  ECOLOGY_LOCAL_BUBBLE,
  ECOLOGY_OBSERVE_OPPORTUNITY,
  ECOLOGY_PROACTIVE_DECISION,
  ECOLOGY_STATE_UPDATED,
  EcologyEngine
};
