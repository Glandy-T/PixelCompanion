const { ChatGPTProcessBridge } = require('./chatgpt-process-bridge');
const { CodexProcessBridge } = require('./codex-process-bridge');
const { CodexSqliteObserver } = require('./codex-sqlite-observer');
const { mergeBridgeConfig } = require('./bridge-config');
const { BRIDGE_STATE_UPDATED, createBridgeStateEvent, emitBridgeEvent } = require('./bridge-events');

class BridgeManager {
  constructor(options = {}) {
    if (!options.eventBus) {
      throw new Error('BridgeManager requires an EventBus.');
    }

    this.eventBus = options.eventBus;
    this.config = mergeBridgeConfig(options.config);
    this.started = false;
    this.unsubscribeEnvironment = null;
    this.lastEvent = null;
    const commonOptions = {
      emit: (type, payload) => this.publishBridgeEvent(type, payload),
      onUpdate: () => this.publishState()
    };
    this.chatgptBridge = options.chatgptBridge ?? new ChatGPTProcessBridge({
      ...commonOptions,
      pollIntervalMs: this.config.processObservation.pollIntervalMs,
      getProcessNames: options.getProcessNames
    });
    this.codexBridge = options.codexBridge ?? new CodexProcessBridge({
      ...commonOptions,
      pollIntervalMs: this.config.processObservation.pollIntervalMs,
      getProcessNames: options.getProcessNames
    });
    this.sqliteObserver = options.sqliteObserver ?? new CodexSqliteObserver({
      ...commonOptions,
      enabled: this.config.sqliteObservation.enabled,
      pollIntervalMs: this.config.sqliteObservation.pollIntervalMs,
      resolveDatabasePath: options.resolveDatabasePath
    });
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    if (this.config.processObservation.enabled) {
      this.chatgptBridge.start();
      this.codexBridge.start();
    }
    if (this.config.sqliteObservation.enabled) {
      this.sqliteObserver.start();
    }
    this.unsubscribeEnvironment = this.eventBus.on('environment.state.updated', (event) => {
      this.chatgptBridge.observeForeground(event.payload.currentApp);
    });
    this.publishState();
  }

  stop() {
    this.started = false;
    this.unsubscribeEnvironment?.();
    this.unsubscribeEnvironment = null;
    this.chatgptBridge.stop();
    this.codexBridge.stop();
    this.sqliteObserver.stop();
    this.publishState();
  }

  setSqliteObservationEnabled(enabled) {
    this.config.sqliteObservation.enabled = Boolean(enabled);
    this.sqliteObserver.setEnabled(enabled);
    if (this.started && enabled) {
      this.sqliteObserver.start();
    }
    this.publishState();
    return this.getSnapshot();
  }

  publishBridgeEvent(type, payload = {}) {
    const event = emitBridgeEvent(this.eventBus, type, payload, { source: 'bridge-manager' });
    this.lastEvent = { type: event.type, observedAt: event.timestamp };
    this.publishState();
    return event;
  }

  publishState() {
    this.eventBus.emit(createBridgeStateEvent(this.getSnapshot()));
  }

  currentMode() {
    if (!this.config.processObservation.enabled) {
      return 'unavailable';
    }

    if (this.config.sqliteObservation.enabled && this.sqliteObserver.getSnapshot().schemaHealth === 'healthy') {
      return 'process-plus-sqlite';
    }

    return 'process-only';
  }

  capabilities() {
    const sqlite = this.sqliteObserver.getSnapshot();
    return {
      processObservation: this.config.processObservation.enabled,
      sqliteObservation: {
        enabled: this.config.sqliteObservation.enabled,
        experimental: this.config.sqliteObservation.experimental,
        schemaHealthy: sqlite.schemaHealth === 'healthy'
      }
    };
  }

  health() {
    const chatgpt = this.chatgptBridge.health();
    const codex = this.codexBridge.health();
    const sqlite = this.sqliteObserver.health();
    return {
      status: chatgpt.healthy && codex.healthy && (!sqlite.enabled || sqlite.pollingHealthy)
        ? 'healthy'
        : 'degraded',
      polling: {
        chatgpt: chatgpt.healthy,
        codex: codex.healthy,
        sqlite: !sqlite.enabled || sqlite.pollingHealthy
      }
    };
  }

  getSnapshot() {
    return {
      mode: this.currentMode(),
      capabilities: this.capabilities(),
      health: this.health(),
      chatgpt: this.chatgptBridge.getSnapshot(),
      codex: this.codexBridge.getSnapshot(),
      sqlite: this.sqliteObserver.getSnapshot(),
      lastEvent: this.lastEvent
    };
  }
}

module.exports = {
  BRIDGE_STATE_UPDATED,
  BridgeManager
};
