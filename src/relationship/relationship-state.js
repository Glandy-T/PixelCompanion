const { RELATIONSHIP_ACTIONS } = require('./relationship-config');

function clampUnit(value, fallback = 0) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function normalizeRelationshipState(value = {}, config = {}) {
  const interactionCount = Number.isInteger(value.interactionCount) && value.interactionCount >= 0
    ? value.interactionCount
    : 0;
  return {
    version: 1,
    bond: clampUnit(value.bond, config.initialBond ?? 0.2),
    familiarity: clampUnit(value.familiarity),
    interactionCount,
    lastInteractionAt: Number.isFinite(value.lastInteractionAt) ? value.lastInteractionAt : null,
    lastAction: RELATIONSHIP_ACTIONS.includes(value.lastAction) ? value.lastAction : null
  };
}

class RelationshipState {
  constructor(options = {}) {
    this.config = options.config ?? {};
    this.value = normalizeRelationshipState(options.initialState, this.config);
  }

  record(action, now, bondDelta) {
    const interactionCount = this.value.interactionCount + 1;
    this.value = {
      ...this.value,
      bond: clampUnit(this.value.bond + bondDelta),
      familiarity: clampUnit(1 - Math.exp(-interactionCount / (this.config.familiarityScale ?? 40))),
      interactionCount,
      lastInteractionAt: now,
      lastAction: action
    };
    return this.getSnapshot();
  }

  getSnapshot() {
    return { ...this.value };
  }
}

module.exports = { RelationshipState, clampUnit, normalizeRelationshipState };
