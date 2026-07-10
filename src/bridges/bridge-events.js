const { createEvent } = require('../core/event-bus');

const AI_BRIDGE_EVENTS = Object.freeze({
  CHATGPT_STARTED: 'ai.chatgpt.started',
  CHATGPT_STOPPED: 'ai.chatgpt.stopped',
  CHATGPT_FOREGROUND: 'ai.chatgpt.foreground',
  CHATGPT_BACKGROUND: 'ai.chatgpt.background',
  CODEX_STARTED: 'ai.codex.started',
  CODEX_STOPPED: 'ai.codex.stopped',
  CODEX_HOST_STARTED: 'ai.codex.host.started',
  CODEX_HOST_STOPPED: 'ai.codex.host.stopped',
  CODEX_ACTIVITY_STARTED: 'ai.codex.activity.started',
  CODEX_ACTIVITY_UPDATED: 'ai.codex.activity.updated',
  CODEX_ACTIVITY_STOPPED: 'ai.codex.activity.stopped',
  CODEX_ACTIVITY_DETECTED: 'ai.codex.activity.detected',
  CODEX_JOB_CHANGED: 'ai.codex.job.changed',
  CODEX_JOB_STARTED: 'ai.codex.job.started',
  CODEX_JOB_WAITING: 'ai.codex.job.waiting',
  CODEX_JOB_COMPLETED: 'ai.codex.job.completed',
  CODEX_JOB_FAILED: 'ai.codex.job.failed',
  CODEX_JOB_UNKNOWN: 'ai.codex.job.unknown'
});

const BRIDGE_STATE_UPDATED = 'bridge:state.updated';
const KNOWN_EVENT_TYPES = new Set(Object.values(AI_BRIDGE_EVENTS));

function createBridgeEvent(type, payload = {}, options = {}) {
  if (!KNOWN_EVENT_TYPES.has(type)) {
    throw new TypeError(`Unsupported bridge event type: ${type}`);
  }

  return createEvent(type, {
    source: options.source ?? 'bridge',
    payload: {
      observedAt: options.observedAt ?? Date.now(),
      ...payload
    }
  });
}

function emitBridgeEvent(eventBus, type, payload = {}, options = {}) {
  if (!eventBus || typeof eventBus.emit !== 'function') {
    throw new TypeError('A compatible EventBus is required.');
  }

  return eventBus.emit(createBridgeEvent(type, payload, options));
}

function createBridgeStateEvent(snapshot) {
  return createEvent(BRIDGE_STATE_UPDATED, {
    source: 'bridge-manager',
    payload: snapshot
  });
}

module.exports = {
  AI_BRIDGE_EVENTS,
  BRIDGE_STATE_UPDATED,
  createBridgeEvent,
  emitBridgeEvent,
  createBridgeStateEvent
};
