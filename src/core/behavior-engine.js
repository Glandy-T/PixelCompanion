const { createEvent } = require('./event-bus');
const { STATE_DEFINITIONS, canInterrupt, getStateDefinition, isBehaviorState } = require('./priority');

class BehaviorEngine {
  constructor(options) {
    if (!options?.eventBus || !options?.stateStore) {
      throw new Error('BehaviorEngine requires an event bus and a state store.');
    }

    this.eventBus = options.eventBus;
    this.stateStore = options.stateStore;
    this.definitions = options.definitions ?? STATE_DEFINITIONS;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.setTimeout = options.setTimeoutFn ?? setTimeout;
    this.clearTimeout = options.clearTimeoutFn ?? clearTimeout;
    this.idleIntervalMs = options.idleIntervalMs ?? 6500;
    this.lastEventAt = new Map();
    this.stateTimer = null;
    this.idleTimer = null;
    this.unsubscribe = null;
    this.started = false;
    this.sequence = 0;

    const initial = this.stateStore.getSnapshot();
    if (!initial.state || !initial.variant) {
      this.stateStore.set(this.createSnapshot('idle', { reason: 'initial' }));
    }
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.unsubscribe = this.eventBus.on('behavior:request', (event) => this.request(event));
    this.scheduleIdleVariant();
  }

  stop() {
    this.started = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clearTimers();
  }

  getSnapshot() {
    return this.stateStore.getSnapshot();
  }

  request(event) {
    const request = event?.type === 'behavior:request'
      ? event
      : createEvent('behavior:request', { source: 'system', payload: event ?? {} });
    const payload = request.payload;
    const state = payload.state;

    if (!isBehaviorState(state)) {
      return this.reject(request, 'unknown-state');
    }

    const definition = getStateDefinition(state);
    const current = this.getSnapshot();
    const force = payload.force === true;
    const dedupeKey = payload.dedupeKey ?? state;
    const cooldownMs = payload.cooldownMs ?? definition.cooldownMs;
    const previousAt = this.lastEventAt.get(dedupeKey);
    const now = this.now();

    if (!force && previousAt !== undefined && now - previousAt < cooldownMs) {
      return this.reject(request, 'cooldown');
    }

    if (!force && current.state !== 'idle' && state !== current.state && !canInterrupt(current.state, state)) {
      return this.reject(request, 'lower-priority');
    }

    this.lastEventAt.set(dedupeKey, now);
    const snapshot = this.transition(state, {
      source: request.source,
      reason: payload.reason ?? request.type,
      triggerEventType: payload.triggerEventType ?? request.type,
      bubbleText: payload.bubbleText ?? definition.bubbleText,
      durationMs: payload.durationMs ?? definition.durationMs
    });

    return { accepted: true, snapshot };
  }

  transition(state, details = {}) {
    const definition = getStateDefinition(state);
    const previous = this.getSnapshot();
    const snapshot = this.createSnapshot(state, {
      ...details,
      priority: definition.priority,
      variant: state === 'idle' ? this.pickIdleVariant() : state,
      lastTriggerEventType: details.triggerEventType ?? previous.lastTriggerEventType ?? null
    });

    this.clearStateTimer();
    this.stateStore.set(snapshot);
    this.eventBus.emit(createEvent('behavior:state-changed', {
      source: 'behavior-engine',
      payload: snapshot
    }));

    if (snapshot.durationMs !== null && snapshot.durationMs > 0) {
      const sequence = snapshot.sequence;
      this.stateTimer = this.setTimeout(() => {
        if (this.getSnapshot().sequence === sequence) {
          this.transition('idle', { reason: `${state}:timeout`, source: 'behavior-engine' });
        }
      }, snapshot.durationMs);
    }

    this.scheduleIdleVariant();
    return snapshot;
  }

  createSnapshot(state, details) {
    const definition = getStateDefinition(state);
    const now = this.now();
    const durationMs = details.durationMs ?? definition.durationMs;

    return {
      state,
      variant: details.variant ?? (state === 'idle' ? this.pickIdleVariant() : state),
      priority: details.priority ?? definition.priority,
      source: details.source ?? 'behavior-engine',
      reason: details.reason ?? 'transition',
      triggerEventType: details.triggerEventType ?? null,
      lastTriggerEventType: details.lastTriggerEventType ?? details.triggerEventType ?? null,
      bubbleText: details.bubbleText ?? definition.bubbleText,
      durationMs,
      startedAt: now,
      expiresAt: durationMs === null ? null : now + durationMs,
      sequence: ++this.sequence
    };
  }

  pickIdleVariant() {
    const variants = this.definitions.idle.variants;
    return variants[Math.floor(this.random() * variants.length)] ?? variants[0];
  }

  scheduleIdleVariant() {
    this.clearIdleTimer();
    if (!this.started || this.getSnapshot().state !== 'idle') {
      return;
    }

    this.idleTimer = this.setTimeout(() => {
      if (this.started && this.getSnapshot().state === 'idle') {
        this.transition('idle', { reason: 'idle-variant', source: 'behavior-engine' });
      }
    }, this.idleIntervalMs);
  }

  reject(event, reason) {
    this.eventBus.emit(createEvent('behavior:ignored', {
      source: 'behavior-engine',
      payload: { eventId: event.id, requestedState: event.payload?.state, reason }
    }));
    return { accepted: false, reason };
  }

  clearStateTimer() {
    if (this.stateTimer) {
      this.clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      this.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  clearTimers() {
    this.clearStateTimer();
    this.clearIdleTimer();
  }
}

module.exports = {
  BehaviorEngine
};
