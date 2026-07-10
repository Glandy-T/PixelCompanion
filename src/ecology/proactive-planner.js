const LOCAL_DIALOGUE_POOL = Object.freeze({
  idle: Object.freeze(['Hm.', '...']),
  working: Object.freeze(['Still at it?', 'Take your time.']),
  lateNight: Object.freeze(["You're still awake."]),
  rapidSwitching: Object.freeze(['Looking for something?'])
});

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, value) / total]));
}

class ProactivePlanner {
  constructor(options = {}) {
    this.random = options.random;
    this.cooldownMs = options.cooldownMs ?? 90000;
    this.dialogueCooldownMs = options.dialogueCooldownMs ?? 180000;
  }

  getWeights(context) {
    const drives = context.drives;
    const lateNight = context.timePeriod === 'late-night';
    const highPriority = (context.currentBehavior?.priority ?? 0) >= 50;
    const workingFocus = context.currentBehavior?.state === 'working' && drives.focus >= 0.65;
    return normalizeWeights({
      'no-op': 0.6 + drives.focus * 0.22 + (highPriority ? 1 : 0) + (workingFocus ? 0.35 : 0),
      'animation-only': 0.25 + (1 - drives.energy) * 0.28,
      'local-bubble': Math.max(0.01, 0.1 + drives.socialDrive * 0.2 - drives.focus * 0.1 - (lateNight ? 0.08 : 0)),
      'observe-opportunity': 0.05 + drives.curiosity * 0.24
    });
  }

  evaluate(context, options = {}) {
    const now = context.now;
    const highPriority = (context.currentBehavior?.priority ?? 0) >= 50;
    const workingFocus = context.currentBehavior?.state === 'working' && context.drives.focus >= 0.65;
    if (!options.force && (highPriority || workingFocus)) {
      return { type: 'no-op', reason: highPriority ? 'high-priority-behavior' : 'high-focus-working' };
    }
    if (!options.force && context.memory.lastProactiveAt && now - context.memory.lastProactiveAt < this.cooldownMs) {
      return { type: 'no-op', reason: 'proactive-cooldown' };
    }

    const weights = this.getWeights(context);
    let cursor = this.random.next();
    let type = 'no-op';
    for (const [candidate, weight] of Object.entries(weights)) {
      cursor -= weight;
      if (cursor <= 0) {
        type = candidate;
        break;
      }
    }

    if (type === 'animation-only') {
      return {
        type,
        behaviorState: context.drives.energy < 0.35 ? 'sleepy' : 'idle',
        reason: context.drives.energy < 0.35 ? 'low-energy' : 'ambient-motion'
      };
    }
    if (type === 'local-bubble') {
      const message = this.pickDialogue(context);
      return message ? { type, message, reason: 'local-dialogue' } : { type: 'no-op', reason: 'dialogue-dedupe' };
    }
    if (type === 'observe-opportunity') {
      return { type, reason: 'curiosity-opportunity' };
    }
    return { type: 'no-op', reason: 'weighted-no-op' };
  }

  pickDialogue(context) {
    let pool = LOCAL_DIALOGUE_POOL.idle;
    if (context.timePeriod === 'late-night') {
      pool = LOCAL_DIALOGUE_POOL.lateNight;
    } else if (context.recentSwitchCount >= 4) {
      pool = LOCAL_DIALOGUE_POOL.rapidSwitching;
    } else if (context.currentAppCategory === 'development' || context.currentAppCategory === 'creative-3d') {
      pool = LOCAL_DIALOGUE_POOL.working;
    }

    const available = pool.filter((message) => !context.memory.wasDialogueRecent(message, context.now - this.dialogueCooldownMs));
    if (available.length === 0) {
      return null;
    }

    return available[Math.min(available.length - 1, Math.floor(this.random.next() * available.length))];
  }
}

module.exports = { LOCAL_DIALOGUE_POOL, ProactivePlanner, normalizeWeights };
