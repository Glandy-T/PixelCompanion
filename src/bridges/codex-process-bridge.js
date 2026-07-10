const { AI_BRIDGE_EVENTS } = require('./bridge-events');
const { normalizeProcessName } = require('../sensors/app-category');
const { listWindowsProcessNames } = require('./chatgpt-process-bridge');

class CodexProcessBridge {
  constructor(options = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.getProcessNames = options.getProcessNames ?? listWindowsProcessNames;
    this.emit = options.emit ?? (() => {});
    this.onUpdate = options.onUpdate ?? (() => {});
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.timer = null;
    this.polling = false;
    this.state = {
      present: false,
      hostPresent: false,
      initialized: false,
      lastPollAt: null,
      lastError: null
    };
  }

  start() {
    if (this.timer) {
      return;
    }

    void this.poll();
    this.timer = this.setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      this.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    if (this.polling) {
      return;
    }

    this.polling = true;
    try {
      this.observeProcessNames(await this.getProcessNames());
      this.state.lastError = null;
    } catch {
      this.state.lastError = 'process-list-unavailable';
      this.onUpdate(this.getSnapshot());
    } finally {
      this.state.lastPollAt = Date.now();
      this.polling = false;
    }
  }

  observeProcessNames(processNames) {
    const names = new Set((processNames ?? []).map(normalizeProcessName));
    const present = names.has('codex');
    const hostPresent = names.has('codex-code-mode-host');
    const previous = this.state.present;
    const previousHost = this.state.hostPresent;
    this.state.present = present;
    this.state.hostPresent = hostPresent;
    this.state.initialized = true;

    if (present !== previous) {
      this.emit(present ? AI_BRIDGE_EVENTS.CODEX_STARTED : AI_BRIDGE_EVENTS.CODEX_STOPPED);
    }
    if (hostPresent !== previousHost) {
      this.emit(hostPresent ? AI_BRIDGE_EVENTS.CODEX_HOST_STARTED : AI_BRIDGE_EVENTS.CODEX_HOST_STOPPED);
    }

    this.onUpdate(this.getSnapshot());
  }

  getSnapshot() {
    return { ...this.state, healthy: !this.state.lastError };
  }

  health() {
    return this.getSnapshot();
  }
}

module.exports = {
  CodexProcessBridge
};
