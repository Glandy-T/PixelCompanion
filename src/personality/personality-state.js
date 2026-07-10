const {
  PERSONALITY_TRAITS,
  clampPersonalityValue,
  normalizePersonalityTraits
} = require('./personality-config');

class PersonalityState {
  constructor(options = {}) {
    this.defaultTraits = normalizePersonalityTraits(options.defaultTraits);
    this.traits = { ...this.defaultTraits };
    this.state = 'ready';
  }

  hasTrait(name) {
    return PERSONALITY_TRAITS.includes(name);
  }

  getTrait(name) {
    return this.hasTrait(name) ? this.traits[name] : undefined;
  }

  getTraits() {
    return { ...this.traits };
  }

  setTrait(name, value) {
    if (!this.hasTrait(name)) {
      throw new Error(`Unknown personality trait: ${name}`);
    }

    this.traits[name] = clampPersonalityValue(value);
    return this.traits[name];
  }

  setTraits(values = {}) {
    for (const trait of PERSONALITY_TRAITS) {
      if (Object.prototype.hasOwnProperty.call(values, trait)) {
        this.setTrait(trait, values[trait]);
      }
    }
    return this.getTraits();
  }

  reset() {
    this.traits = { ...this.defaultTraits };
    this.state = 'ready';
    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      state: this.state,
      traits: this.getTraits()
    };
  }
}

module.exports = { PersonalityState };
