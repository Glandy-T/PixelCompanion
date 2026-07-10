class LocalMemory {
  constructor(options = {}) {
    this.capacity = options.capacity ?? 24;
    this.values = {
      recentAppCategories: [],
      recentAppSwitches: [],
      recentUserInteractions: [],
      recentBehaviorStates: [],
      recentProactiveActions: [],
      recentLocalDialogues: [],
      lastProactiveAt: null,
      lastAiObservationAt: null,
      lastMeaningfulEnvironmentChangeAt: null
    };
  }

  push(name, entry) {
    const list = this.values[name];
    if (!Array.isArray(list)) {
      throw new TypeError(`Unknown memory list: ${name}`);
    }

    list.push(entry);
    while (list.length > this.capacity) {
      list.shift();
    }
  }

  recordAppCategory(category, at) {
    this.push('recentAppCategories', { category, at });
  }

  recordAppSwitch(category, at) {
    this.push('recentAppSwitches', { category, at });
    this.values.lastMeaningfulEnvironmentChangeAt = at;
  }

  recordInteraction(kind, at) {
    this.push('recentUserInteractions', { kind, at });
  }

  recordBehavior(state, at) {
    this.push('recentBehaviorStates', { state, at });
  }

  recordProactive(action, at) {
    this.push('recentProactiveActions', { action, at });
    this.values.lastProactiveAt = at;
  }

  recordDialogue(message, at) {
    this.push('recentLocalDialogues', { message, at });
  }

  wasDialogueRecent(message, since) {
    return this.values.recentLocalDialogues.some((entry) => entry.message === message && entry.at >= since);
  }

  recentInteractionCount(since) {
    return this.values.recentUserInteractions.filter((entry) => entry.at >= since).length;
  }

  getSnapshot() {
    return {
      recentAppCategoryCount: this.values.recentAppCategories.length,
      recentAppSwitchCount: this.values.recentAppSwitches.length,
      recentUserInteractionCount: this.values.recentUserInteractions.length,
      recentBehaviorStateCount: this.values.recentBehaviorStates.length,
      recentProactiveActionCount: this.values.recentProactiveActions.length,
      recentLocalDialogueCount: this.values.recentLocalDialogues.length,
      lastProactiveAt: this.values.lastProactiveAt,
      lastAiObservationAt: this.values.lastAiObservationAt,
      lastMeaningfulEnvironmentChangeAt: this.values.lastMeaningfulEnvironmentChangeAt
    };
  }
}

module.exports = { LocalMemory };
