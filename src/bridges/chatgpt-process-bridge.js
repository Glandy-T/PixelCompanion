const { execFile } = require('node:child_process');
const { AI_BRIDGE_EVENTS } = require('./bridge-events');
const { normalizeProcessName } = require('../sensors/app-category');

function listWindowsProcessNames() {
  if (process.platform !== 'win32') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    execFile('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      timeout: 2500,
      maxBuffer: 1024 * 1024
    }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const names = stdout.split(/\r?\n/)
        .map((line) => line.match(/^"([^"]+)"/))
        .filter(Boolean)
        .map((match) => match[1]);
      resolve(names);
    });
  });
}

class ChatGPTProcessBridge {
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
      foreground: false,
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
    const present = (processNames ?? []).some((name) => normalizeProcessName(name) === 'chatgpt');
    const previous = this.state.present;
    this.state.present = present;
    this.state.initialized = true;

    if (present !== previous) {
      this.emit(present ? AI_BRIDGE_EVENTS.CHATGPT_STARTED : AI_BRIDGE_EVENTS.CHATGPT_STOPPED);
      if (!present) {
        this.state.foreground = false;
      }
    }

    this.onUpdate(this.getSnapshot());
  }

  observeForeground(processName) {
    const foreground = this.state.present && normalizeProcessName(processName) === 'chatgpt';
    if (foreground === this.state.foreground) {
      return;
    }

    this.state.foreground = foreground;
    this.emit(foreground ? AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND : AI_BRIDGE_EVENTS.CHATGPT_BACKGROUND);
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
  ChatGPTProcessBridge,
  listWindowsProcessNames
};
