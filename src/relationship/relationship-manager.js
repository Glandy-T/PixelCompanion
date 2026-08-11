const { createEvent } = require('../core/event-bus');
const { RELATIONSHIP_ACTIONS, mergeRelationshipConfig } = require('./relationship-config');
const { RelationshipState } = require('./relationship-state');

const RELATIONSHIP_STATE_UPDATED = 'relationship.state.updated';
const RELATIONSHIP_INTERACTION_RECORDED = 'relationship.interaction.recorded';

class RelationshipManager {
  constructor(options = {}) {
    if (!options.eventBus) {
      throw new Error('RelationshipManager requires an EventBus.');
    }
    this.eventBus = options.eventBus;
    this.config = mergeRelationshipConfig(options.config);
    this.store = options.store;
    this.now = options.now ?? (() => Date.now());
    this.state = new RelationshipState({
      config: this.config,
      initialState: this.store?.load()
    });
    this.lastAcceptedByAction = new Map();
  }

  start() {
    this.publishState();
  }

  stop() {
    this.store?.save(this.state.getSnapshot());
  }

  recordInteraction(action) {
    if (!RELATIONSHIP_ACTIONS.includes(action)) {
      return { accepted: false, reason: 'unsupported-action', state: this.getSnapshot() };
    }
    const now = this.now();
    const lastAcceptedAt = this.lastAcceptedByAction.get(action);
    if (Number.isFinite(lastAcceptedAt) && now - lastAcceptedAt < this.config.minimumInteractionIntervalMs) {
      return { accepted: false, reason: 'interaction-cooldown', state: this.getSnapshot() };
    }

    this.lastAcceptedByAction.set(action, now);
    const state = this.state.record(action, now, this.config.bondDelta[action] ?? 0);
    this.store?.save(state);
    this.eventBus.emit(createEvent(RELATIONSHIP_INTERACTION_RECORDED, {
      source: 'relationship-manager',
      payload: { action, interactionCount: state.interactionCount }
    }));
    this.publishState();
    return { accepted: true, reason: null, state: this.getSnapshot() };
  }

  publishState() {
    this.eventBus.emit(createEvent(RELATIONSHIP_STATE_UPDATED, {
      source: 'relationship-manager',
      payload: this.getSnapshot()
    }));
  }

  getSnapshot() {
    return {
      ...this.state.getSnapshot(),
      persistence: 'local-only',
      storesContent: false
    };
  }
}

module.exports = {
  RELATIONSHIP_INTERACTION_RECORDED,
  RELATIONSHIP_STATE_UPDATED,
  RelationshipManager
};
