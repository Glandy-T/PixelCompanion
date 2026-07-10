class EcologyTick {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs ?? 5000;
    this.onTick = options.onTick ?? (() => {});
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.timer = this.setInterval(() => this.onTick(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      this.clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running() {
    return Boolean(this.timer);
  }
}

module.exports = { EcologyTick };
