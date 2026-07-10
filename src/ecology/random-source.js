class RandomSource {
  constructor(options = {}) {
    this.mode = options.mode ?? 'seeded';
    this.seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 90210;
    this.state = this.seed;
    this.nativeRandom = options.nativeRandom ?? Math.random;
  }

  next() {
    if (this.mode !== 'seeded') {
      return this.nativeRandom();
    }

    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  pick(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))];
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  getSnapshot() {
    return { mode: this.mode, seed: this.seed, state: this.state };
  }
}

module.exports = { RandomSource };
