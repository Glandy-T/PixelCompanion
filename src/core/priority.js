const STATE_DEFINITIONS = Object.freeze({
  idle: Object.freeze({
    priority: 0,
    durationMs: null,
    cooldownMs: 0,
    bubbleText: '',
    variants: Object.freeze(['idle', 'idle-glance', 'idle-breathe'])
  }),
  sleepy: Object.freeze({
    priority: 10,
    durationMs: 9000,
    cooldownMs: 3000,
    bubbleText: 'Feeling sleepy...'
  }),
  thinking: Object.freeze({
    priority: 20,
    durationMs: 7000,
    cooldownMs: 1200,
    bubbleText: 'Thinking...'
  }),
  working: Object.freeze({
    priority: 30,
    durationMs: 12000,
    cooldownMs: 1200,
    bubbleText: 'Working...'
  }),
  success: Object.freeze({
    priority: 50,
    durationMs: 2800,
    cooldownMs: 1800,
    bubbleText: 'Done!'
  }),
  waiting: Object.freeze({
    priority: 60,
    durationMs: 10000,
    cooldownMs: 2500,
    bubbleText: 'Waiting for input.'
  }),
  alert: Object.freeze({
    priority: 80,
    durationMs: 4500,
    cooldownMs: 2500,
    bubbleText: 'Please take a look!'
  })
});

function isBehaviorState(value) {
  return typeof value === 'string' && Object.hasOwn(STATE_DEFINITIONS, value);
}

function getStateDefinition(state) {
  if (!isBehaviorState(state)) {
    throw new Error(`Unknown behavior state: ${String(state)}`);
  }

  return STATE_DEFINITIONS[state];
}

function canInterrupt(currentState, nextState) {
  return getStateDefinition(nextState).priority > getStateDefinition(currentState).priority;
}

module.exports = {
  STATE_DEFINITIONS,
  canInterrupt,
  getStateDefinition,
  isBehaviorState
};
