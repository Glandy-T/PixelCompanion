const { mergePersonalityConfig } = require('./personality-config');
const { PersonalityState } = require('./personality-state');

class PersonalityManager {
  constructor(options = {}) {
    this.config = mergePersonalityConfig(options.config);
    this.state = options.state ?? new PersonalityState({ defaultTraits: this.config.defaultTraits });
  }

  getTrait(name) {
    return this.state.getTrait(name);
  }

  setTrait(name, value) {
    return this.state.setTrait(name, value);
  }

  setTraits(values) {
    return this.state.setTraits(values);
  }

  reset() {
    return this.state.reset();
  }

  getSnapshot() {
    return this.state.getSnapshot();
  }

  getEcologyModifiers() {
    const traits = this.state.getTraits();
    return {
      futureOnly: true,
      observeOpportunity: traits.curiosity,
      randomInteraction: traits.playfulness,
      localBubbleWarmth: traits.warmth,
      assertiveness: traits.confidence,
      caution: traits.protectiveness,
      restraint: traits.seriousness
    };
  }
}

module.exports = { PersonalityManager };
