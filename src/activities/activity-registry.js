const { isBehaviorState } = require('../core/priority');

// Public fixture, not a character's personality or daily routine. No auto-start.
const PLACEHOLDER_ACTIVITIES = [{
  id: 'observe-demo', label: 'Observe (test)', cooldownMs: 5000,
  steps: [
    { id: 'look', label: 'Looking around', behavior: 'thinking', durationMs: 4000 },
    { id: 'settle', label: 'Settling down', behavior: 'idle', durationMs: 2000 }
  ]
}];

function cloneDefinition(definition) {
  return { ...definition, steps: definition.steps.map(step => ({ ...step })) };
}

class ActivityRegistry {
  constructor(definitions = PLACEHOLDER_ACTIVITIES) {
    if (!Array.isArray(definitions) || definitions.length > 64) throw new TypeError('Invalid activity definitions.');
    this.definitions = new Map();
    for (const value of definitions) {
      if (!value || !/^[a-z][a-z0-9-]{0,63}$/.test(value.id) || this.definitions.has(value.id) ||
          typeof value.label !== 'string' || value.label.length > 80 ||
          !Array.isArray(value.steps) || !value.steps.length || value.steps.length > 32) {
        throw new TypeError('Invalid activity definition.');
      }
      const steps = value.steps.map(step => {
        if (!step || typeof step.id !== 'string' || step.id.length > 64 ||
            typeof step.label !== 'string' || step.label.length > 80 ||
            !isBehaviorState(step.behavior) || !Number.isFinite(step.durationMs) ||
            step.durationMs < 100 || step.durationMs > 600000) throw new TypeError('Invalid activity step.');
        return { id: step.id, label: step.label, behavior: step.behavior, durationMs: Math.round(step.durationMs) };
      });
      this.definitions.set(value.id, {
        id: value.id, label: value.label, steps,
        cooldownMs: Number.isFinite(value.cooldownMs) ? Math.max(0, Math.min(3600000, value.cooldownMs)) : 5000
      });
    }
  }
  get(id) {
    const definition = this.definitions.get(id);
    return definition ? cloneDefinition(definition) : null;
  }
  list() { return [...this.definitions.values()].map(cloneDefinition); }
}

module.exports = { ActivityRegistry, PLACEHOLDER_ACTIVITIES };
