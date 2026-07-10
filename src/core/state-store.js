class StateStore {
  constructor(initialState) {
    this.state = Object.freeze({ ...initialState });
    this.listeners = new Set();
  }

  getSnapshot() {
    return { ...this.state };
  }

  set(nextState) {
    this.state = Object.freeze({ ...nextState });
    const snapshot = this.getSnapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }

    return snapshot;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('State listener must be a function.');
    }

    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

module.exports = {
  StateStore
};
