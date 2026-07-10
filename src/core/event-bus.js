function createEvent(type, options = {}) {
  const timestamp = options.timestamp ?? Date.now();
  const payload = options.payload ?? {};
  const meta = options.meta ?? {};

  if (typeof type !== 'string' || type.length === 0) {
    throw new TypeError('Event type must be a non-empty string.');
  }

  if (!isPlainObject(payload) || !isPlainObject(meta)) {
    throw new TypeError('Event payload and meta must be plain objects.');
  }

  return Object.freeze({
    id: options.id ?? `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    source: options.source ?? 'system',
    timestamp,
    payload: Object.freeze({ ...payload }),
    meta: Object.freeze({ ...meta })
  });
}

function normalizeEvent(event) {
  if (!isPlainObject(event)) {
    throw new TypeError('Event must be an object.');
  }

  return createEvent(event.type, event);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Event listener must be a function.');
    }

    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);

    return () => this.off(type, listener);
  }

  off(type, listener) {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }

    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  emit(event) {
    const normalizedEvent = normalizeEvent(event);
    const listeners = [...(this.listeners.get(normalizedEvent.type) ?? [])];

    for (const listener of listeners) {
      listener(normalizedEvent);
    }

    return normalizedEvent;
  }
}

module.exports = {
  EventBus,
  createEvent,
  normalizeEvent
};
