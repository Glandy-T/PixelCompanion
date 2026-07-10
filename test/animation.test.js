const test = require('node:test');
const assert = require('node:assert/strict');
const { AnimationController } = require('../src/animation/animation-controller');
const { ANIMATIONS, getAnimation } = require('../src/animation/animation-registry');

test('animation registry defines all behavior states with a fallback', () => {
  for (const state of ['idle', 'thinking', 'working', 'waiting', 'success', 'alert', 'sleepy']) {
    const animation = getAnimation(state);
    assert.equal(animation.id, state);
    assert.ok(animation.frames.length > 0);
    assert.ok(animation.frameDuration > 0);
    assert.ok(animation.transitionDuration > 0);
  }

  assert.equal(getAnimation('not-a-state'), ANIMATIONS.idle);
});

test('controller advances looped frames and exposes a transition phase', () => {
  let now = 0;
  const controller = new AnimationController({ now: () => now });
  const entering = controller.setState('thinking');

  assert.equal(entering.transition.to, 'thinking');
  assert.equal(entering.phase, 'enter:look-left');
  now = 500;
  const advanced = controller.tick();
  assert.equal(advanced.frame, 'look-right');
  assert.equal(advanced.transition, null);
});

test('controller holds the final frame of a non-looping animation', () => {
  let now = 0;
  const controller = new AnimationController({ now: () => now });
  controller.setState('success');
  now = 2000;
  const snapshot = controller.tick();

  assert.equal(snapshot.frame, 'settle');
  assert.equal(snapshot.animation.loop, false);
});
