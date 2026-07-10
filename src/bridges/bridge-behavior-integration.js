const { createEvent } = require('../core/event-bus');
const { AI_BRIDGE_EVENTS } = require('./bridge-events');

const BRIDGE_BEHAVIOR_RULES = Object.freeze({
  [AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND]: Object.freeze({
    state: 'thinking',
    source: 'chatgpt-bridge',
    dedupeKey: 'bridge:chatgpt:foreground',
    cooldownMs: 30000,
    reason: 'chatgpt-foreground'
  })
});

class BridgeBehaviorIntegration {
  constructor(options = {}) {
    if (!options.eventBus || !options.behaviorEngine) {
      throw new Error('BridgeBehaviorIntegration requires an EventBus and BehaviorEngine.');
    }

    this.eventBus = options.eventBus;
    this.behaviorEngine = options.behaviorEngine;
    this.unsubscribers = [];
  }

  start() {
    if (this.unsubscribers.length > 0) {
      return;
    }

    for (const [eventType, rule] of Object.entries(BRIDGE_BEHAVIOR_RULES)) {
      this.unsubscribers.push(this.eventBus.on(eventType, (event) => this.requestBehavior(event, rule)));
    }
  }

  stop() {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }

  requestBehavior(event, rule) {
    return this.behaviorEngine.request(createEvent('behavior:request', {
      source: rule.source,
      payload: {
        state: rule.state,
        dedupeKey: rule.dedupeKey,
        cooldownMs: rule.cooldownMs,
        durationMs: rule.durationMs,
        reason: rule.reason,
        triggerEventType: event.type
      }
    }));
  }
}

module.exports = {
  BRIDGE_BEHAVIOR_RULES,
  BridgeBehaviorIntegration
};
