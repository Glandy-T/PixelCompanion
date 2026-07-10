const { createEvent } = require('../core/event-bus');
const { categorizeApp } = require('./app-category');

// Privacy contract: sensor state is memory-only. It never contains window
// titles, window content, keystrokes, clipboard data, screenshots, or uploads.
const PRIVACY_GUARANTEES = Object.freeze({
  persistsToDisk: false,
  readsWindowTitle: false,
  readsInputContent: false,
  readsClipboard: false,
  capturesScreenshots: false,
  uploadsEnvironmentData: false
});

class SensorManager {
  constructor(options) {
    if (!options?.eventBus || !options?.behaviorEngine || !options?.foregroundSensor || !options?.idleSensor) {
      throw new Error('SensorManager requires an event bus, behavior engine, foreground sensor, and idle sensor.');
    }

    this.eventBus = options.eventBus;
    this.behaviorEngine = options.behaviorEngine;
    this.foregroundSensor = options.foregroundSensor;
    this.idleSensor = options.idleSensor;
    this.now = options.now ?? Date.now;
    this.activeAfterMs = options.activeAfterMs ?? 15000;
    this.rapidSwitchWindowMs = options.rapidSwitchWindowMs ?? 20000;
    this.rapidSwitchCount = options.rapidSwitchCount ?? 4;
    this.maxSwitchHistory = options.maxSwitchHistory ?? 8;
    this.activeMilestoneEmitted = false;
    this.unsubscribers = [];
    this.state = {
      currentApp: null,
      currentCategory: 'other',
      appStartedAt: null,
      activeDurationMs: 0,
      recentSwitches: [],
      idleSeconds: 0,
      userState: 'active'
    };

    this.bindEnvironmentMappings();
  }

  start() {
    this.foregroundSensor.start((app) => this.handleForegroundApp(app));
    this.idleSensor.start((snapshot) => this.handleIdleSnapshot(snapshot));
  }

  stop() {
    this.foregroundSensor.stop();
    this.idleSensor.stop();
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  getSnapshot() {
    this.refreshActiveDuration();
    return {
      currentApp: this.state.currentApp,
      currentCategory: this.state.currentCategory,
      activeDurationMs: this.state.activeDurationMs,
      recentSwitches: this.state.recentSwitches.map((entry) => ({ ...entry })),
      idleSeconds: this.state.idleSeconds,
      userState: this.state.userState
    };
  }

  handleForegroundApp(app) {
    const now = this.now();
    const categorized = categorizeApp(app.processName);
    const previousApp = this.state.currentApp;

    if (previousApp !== categorized.processName) {
      this.state.currentApp = categorized.processName;
      this.state.currentCategory = categorized.category;
      this.state.appStartedAt = now;
      this.state.activeDurationMs = 0;
      this.activeMilestoneEmitted = false;
      this.recordSwitch(categorized, now);

      this.emit('environment.app.changed', {
        previousApp,
        app: categorized.processName,
        category: categorized.category
      });

      if (this.recentSwitchCount(now) >= this.rapidSwitchCount) {
        this.emit('environment.app.rapid-switching', {
          recentSwitchCount: this.recentSwitchCount(now),
          windowMs: this.rapidSwitchWindowMs
        });
      }
    } else {
      this.refreshActiveDuration(now);
      if (!this.activeMilestoneEmitted && this.state.activeDurationMs >= this.activeAfterMs) {
        this.activeMilestoneEmitted = true;
        this.emit('environment.app.active', {
          app: this.state.currentApp,
          category: this.state.currentCategory,
          activeDurationMs: this.state.activeDurationMs
        });
      }
    }

    this.publishState();
  }

  handleIdleSnapshot(snapshot) {
    const previousState = this.state.userState;
    this.state.idleSeconds = snapshot.idleSeconds;
    this.state.userState = snapshot.state;
    this.refreshActiveDuration();

    if (snapshot.state !== previousState) {
      if (snapshot.state === 'active') {
        this.emit('environment.user.active', { idleSeconds: snapshot.idleSeconds });
      } else {
        this.emit('environment.user.idle', {
          idleSeconds: snapshot.idleSeconds,
          kind: snapshot.state
        });
      }
    }

    this.publishState();
  }

  bindEnvironmentMappings() {
    this.unsubscribers.push(
      this.eventBus.on('environment.app.active', (event) => {
        const category = event.payload.category;
        if (category === 'development' || category === 'creative-3d') {
          this.requestBehavior('working', `environment:${category}:${event.payload.app}`);
        } else if (category === 'conversation') {
          this.requestBehavior('thinking', `environment:conversation:${event.payload.app}`);
        }
      }),
      this.eventBus.on('environment.user.idle', (event) => {
        if (event.payload.kind === 'long-idle') {
          this.requestBehavior('sleepy', 'environment:long-idle', 300000);
        }
      }),
      this.eventBus.on('environment.app.rapid-switching', () => {
        this.requestBehavior('alert', 'environment:rapid-switching', 60000);
      })
    );
  }

  requestBehavior(state, dedupeKey, cooldownMs) {
    this.behaviorEngine.request(createEvent('behavior:request', {
      source: 'environment-sensor',
      payload: { state, dedupeKey, cooldownMs, reason: 'environment-mapping' }
    }));
  }

  recordSwitch(categorized, at) {
    this.state.recentSwitches.push({
      app: categorized.processName,
      category: categorized.category,
      at
    });
    this.state.recentSwitches = this.state.recentSwitches
      .filter((entry) => at - entry.at <= this.rapidSwitchWindowMs)
      .slice(-this.maxSwitchHistory);
  }

  recentSwitchCount(now) {
    return this.state.recentSwitches.filter((entry) => now - entry.at <= this.rapidSwitchWindowMs).length;
  }

  refreshActiveDuration(now = this.now()) {
    if (this.state.appStartedAt !== null) {
      this.state.activeDurationMs = Math.max(0, now - this.state.appStartedAt);
    }
  }

  publishState() {
    this.emit('environment.state.updated', this.getSnapshot());
  }

  emit(type, payload) {
    this.eventBus.emit(createEvent(type, {
      source: 'environment-sensor',
      payload
    }));
  }
}

module.exports = {
  PRIVACY_GUARANTEES,
  SensorManager
};
