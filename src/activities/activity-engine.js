const { createEvent } = require('../core/event-bus');
const { ActivityRegistry } = require('./activity-registry');

const ACTIVITY_STATE_UPDATED = 'activity.state.updated';
const SOURCE = 'activity-engine';

class ActivityEngine {
  constructor(options = {}) {
    if (!options.eventBus || !options.getBehaviorSnapshot) throw new Error('ActivityEngine requires event bus and behavior snapshot.');
    this.eventBus = options.eventBus;
    this.getBehavior = options.getBehaviorSnapshot;
    this.registry = options.registry ?? new ActivityRegistry();
    this.now = options.now ?? (() => performance.now());
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.timer = null;
    this.unsubscribers = [];
    this.started = false;
    this.applying = false;
    this.sequence = 0;
    this.run = null;
    this.lastFinished = new Map();
    this.blockers = new Set();
    this.interactionUntil = 0;
    this.lastEvent = null;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribers.push(this.eventBus.on('behavior:state-changed', event => {
      if (!this.applying && this.run?.status === 'running' && event.payload.source !== SOURCE) {
        this.pause('behavior-interrupted');
      }
    }));
    this.timer = this.setInterval(() => this.tick(), 250);
    this.publish();
  }

  stop() {
    if (!this.started) return;
    this.cancel('shutdown');
    this.started = false;
    this.clearInterval(this.timer);
    this.timer = null;
    this.unsubscribers.splice(0).forEach(off => off());
    this.blockers.clear();
    this.interactionUntil = 0;
  }

  begin(id) {
    if (!this.started) return { accepted: false, reason: 'not-running' };
    if (this.run && ['running', 'paused'].includes(this.run.status)) return { accepted: false, reason: 'busy' };
    const definition = this.registry.get(id);
    if (!definition) return { accepted: false, reason: 'unknown-activity' };
    const at = this.now();
    const finished = this.lastFinished.get(id);
    if (finished !== undefined && at - finished < definition.cooldownMs) return { accepted: false, reason: 'cooldown' };
    this.run = { id: ++this.sequence, definition, status: 'paused', stepIndex: 0, elapsedMs: 0,
      stepElapsedMs: 0, lastTickAt: at, ownedSequence: null, reason: 'starting' };
    this.emit('activity.started');
    this.tryResume();
    this.publish();
    return { accepted: true, snapshot: this.getSnapshot() };
  }

  ownsBehavior() {
    const current = this.getBehavior();
    return this.run?.ownedSequence != null && current?.source === SOURCE && current.sequence === this.run.ownedSequence;
  }

  releaseBehavior() {
    if (!this.ownsBehavior()) return;
    this.applying = true;
    try {
      this.eventBus.emit(createEvent('behavior:release', { source: SOURCE, payload: { sequence: this.run.ownedSequence } }));
    } finally { this.applying = false; this.run.ownedSequence = null; }
  }

  claimStep() {
    const behavior = this.getBehavior();
    if (behavior.state !== 'idle' && !this.ownsBehavior()) return false;
    this.releaseBehavior();
    const step = this.run.definition.steps[this.run.stepIndex];
    this.applying = true;
    try {
      this.eventBus.emit(createEvent('behavior:request', { source: SOURCE, payload: {
        state: step.behavior, durationMs: step.durationMs - this.run.stepElapsedMs + 1000,
        cooldownMs: 0, dedupeKey: `activity:${this.run.definition.id}:${this.run.stepIndex}`,
        reason: 'activity-step', triggerEventType: 'activity.step'
      } }));
    } finally { this.applying = false; }
    const current = this.getBehavior();
    if (current.source !== SOURCE || current.state !== step.behavior) return false;
    this.run.ownedSequence = current.sequence;
    return true;
  }

  tryResume() {
    if (!this.run || this.run.status !== 'paused' || this.blockers.size || this.now() < this.interactionUntil) return false;
    if (!this.claimStep()) { this.run.reason = 'behavior-busy'; return false; }
    this.run.status = 'running';
    this.run.reason = null;
    this.run.lastTickAt = this.now();
    this.emit('activity.resumed');
    return true;
  }

  advance(now) {
    const run = this.run;
    if (run?.status !== 'running') return;
    // A system sleep or stalled event loop must not silently finish an activity.
    const elapsed = Math.max(0, Math.min(1000, now - run.lastTickAt));
    run.lastTickAt = now;
    const step = run.definition.steps[run.stepIndex];
    const consumed = Math.min(elapsed, step.durationMs - run.stepElapsedMs);
    run.elapsedMs += consumed;
    run.stepElapsedMs += consumed;
  }

  tick() {
    if (!this.started || !this.run || !['running', 'paused'].includes(this.run.status)) return;
    if (this.run.status === 'paused') {
      if (this.tryResume()) this.publish();
      return;
    }
    if (!this.ownsBehavior()) { this.pause('behavior-interrupted'); return; }
    this.advance(this.now());
    const step = this.run.definition.steps[this.run.stepIndex];
    if (this.run.stepElapsedMs >= step.durationMs) {
      if (this.run.stepIndex === this.run.definition.steps.length - 1) {
        this.finish('completed', 'finished');
        return;
      }
      this.releaseBehavior();
      this.run.stepIndex++;
      this.run.stepElapsedMs = 0;
      if (!this.claimStep()) { this.pause('behavior-busy'); return; }
      this.emit('activity.step.changed');
    }
    this.publish();
  }

  pause(reason = 'manual') {
    if (this.run?.status !== 'running') return;
    this.advance(this.now());
    this.run.status = 'paused';
    this.run.reason = reason;
    this.releaseBehavior();
    this.emit('activity.paused');
    this.publish();
  }

  setBlocked(reason, blocked) {
    if (blocked) this.blockers.add(reason); else this.blockers.delete(reason);
    if (blocked) this.pause(reason);
    this.publish();
  }

  interruptForInteraction() {
    this.interactionUntil = this.now() + 1500;
    this.pause('interaction');
  }

  cancel(reason = 'cancelled') {
    if (this.run && ['running', 'paused'].includes(this.run.status)) this.finish('cancelled', reason);
  }

  finish(status, reason) {
    this.run.status = status;
    this.run.reason = reason;
    this.releaseBehavior();
    this.lastFinished.set(this.run.definition.id, this.now());
    this.emit(`activity.${status}`);
    this.publish();
  }

  emit(type) {
    this.lastEvent = type;
    this.eventBus.emit(createEvent(type, { source: SOURCE, payload: {
      activityId: this.run.definition.id, runId: this.run.id, stepIndex: this.run.stepIndex
    } }));
  }

  publish() {
    this.eventBus.emit(createEvent(ACTIVITY_STATE_UPDATED, { source: SOURCE, payload: this.getSnapshot() }));
  }

  getSnapshot() {
    const run = this.run;
    const step = run?.definition.steps[run.stepIndex];
    const totalMs = run?.definition.steps.reduce((sum, entry) => sum + entry.durationMs, 0) ?? 0;
    return { status: run?.status ?? 'idle', activityId: run?.definition.id ?? null,
      label: run?.definition.label ?? null, step: step?.label ?? null, stepIndex: run?.stepIndex ?? 0,
      elapsedMs: run?.elapsedMs ?? 0, totalMs, progress: totalMs ? run.elapsedMs / totalMs : 0,
      pauseReason: run?.reason ?? null, blockers: [...this.blockers], lastEvent: this.lastEvent,
      autoStart: false, persistence: 'memory-only', available: this.registry.list().map(({ id, label }) => ({ id, label })) };
  }
}

module.exports = { ACTIVITY_STATE_UPDATED, ActivityEngine };
