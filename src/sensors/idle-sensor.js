class IdleSensor {
  constructor(options = {}) {
    if (!options.powerMonitor) {
      throw new Error('IdleSensor requires Electron powerMonitor.');
    }

    this.powerMonitor = options.powerMonitor;
    this.idleAfterSeconds = options.idleAfterSeconds ?? 60;
    this.longIdleAfterSeconds = options.longIdleAfterSeconds ?? 300;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.onSnapshot = null;
    this.timer = null;
  }

  start(onSnapshot) {
    this.onSnapshot = onSnapshot;
    this.poll();
    this.timer = this.setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      this.clearInterval(this.timer);
      this.timer = null;
    }

    this.onSnapshot = null;
  }

  poll() {
    const idleSeconds = Math.max(0, Math.floor(this.powerMonitor.getSystemIdleTime()));
    const state = idleSeconds >= this.longIdleAfterSeconds
      ? 'long-idle'
      : idleSeconds >= this.idleAfterSeconds
        ? 'idle'
        : 'active';

    this.onSnapshot?.({ idleSeconds, state });
  }
}

module.exports = {
  IdleSensor
};
