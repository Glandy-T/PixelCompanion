const DRIVE_NAMES = Object.freeze(['energy', 'curiosity', 'attention', 'socialDrive', 'focus', 'arousal']);

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

class DriveModel {
  constructor(options = {}) {
    this.maxDelta = options.maxDelta ?? 0.12;
    this.defaults = { ...options.defaults };
    this.values = {};
    this.reset(options.defaults);
  }

  reset(values = this.defaults) {
    for (const drive of DRIVE_NAMES) {
      this.values[drive] = clamp(Number(values?.[drive] ?? 0.5));
    }
  }

  adjust(deltas = {}, options = {}) {
    const multiplier = options.multiplier ?? 1;
    for (const drive of DRIVE_NAMES) {
      if (!Number.isFinite(deltas[drive])) {
        continue;
      }

      const limit = options.allowLargeDelta ? Infinity : this.maxDelta;
      const delta = Math.min(limit, Math.max(-limit, deltas[drive] * multiplier));
      this.values[drive] = clamp(this.values[drive] + delta);
    }
    return this.getSnapshot();
  }

  decay(elapsedMs, timePeriod) {
    const seconds = Math.max(0, elapsedMs) / 1000;
    if (seconds === 0) {
      return this.getSnapshot();
    }

    const lateNightMultiplier = timePeriod === 'late-night' ? 1.75 : 1;
    this.adjust({
      energy: -0.00008 * seconds * lateNightMultiplier,
      arousal: -0.00011 * seconds,
      attention: -0.00004 * seconds,
      curiosity: -0.000025 * seconds,
      socialDrive: -0.000015 * seconds,
      focus: -0.00002 * seconds
    }, { allowLargeDelta: true });
    return this.getSnapshot();
  }

  getSnapshot() {
    return { ...this.values };
  }
}

module.exports = { DRIVE_NAMES, DriveModel, clamp };
