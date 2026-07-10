function getTimePeriod(hour) {
  if (hour >= 5 && hour < 11) {
    return 'morning';
  }
  if (hour >= 11 && hour < 17) {
    return 'daytime';
  }
  if (hour >= 17 && hour < 22) {
    return 'evening';
  }
  return 'late-night';
}

class EcologyState {
  constructor(options = {}) {
    this.now = options.now ?? (() => Date.now());
    this.getHour = options.getHour ?? (() => new Date(this.now()).getHours());
    this.lastTickAt = this.now();
    this.paused = false;
  }

  updateTime(now = this.now()) {
    this.lastTickAt = now;
    return this.getTime();
  }

  getTime() {
    const hourOfDay = this.getHour();
    return { hourOfDay, timePeriod: getTimePeriod(hourOfDay) };
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }
}

module.exports = { EcologyState, getTimePeriod };
