const test = require('node:test');
const assert = require('node:assert/strict');
const { MotionDriver, STATES, samplePose } = require('../src/animation/motion-driver');

test('all seven motions have distinct finite poses and unknown motions fall back', () => {
  const poses = STATES.map(state => samplePose(state, 0.37));
  assert.equal(new Set(poses.map(p => JSON.stringify(p))).size, 7);
  assert.ok(poses.every(p => Object.values(p).every(Number.isFinite)));
  const driver = new MotionDriver({ now: () => 0 });
  assert.equal(driver.setState('missing').state, 'idle');
});

test('interruption blends from the current pose without position jumps or drift', () => {
  const driver = new MotionDriver({ now: () => 0 });
  driver.setState('working', {}, 0);
  const before = driver.tick(600).pose;
  driver.setState('alert', {}, 600);
  assert.deepEqual(driver.tick(600).pose, before);
  driver.setState('idle', {}, 900);
  const after = driver.tick(5000).pose;
  assert.equal(after.x, 0);
  assert.equal(after.lean, 0);
});

test('one-shot completion fires once and returns visually to rest', () => {
  const completions = [];
  const driver = new MotionDriver({ now: () => 0, onComplete: e => completions.push(e) });
  driver.setState('success', {}, 0);
  driver.tick(600);
  assert.ok(driver.pose.y > 0.3);
  assert.equal(driver.tick(1400).phase, 'rest');
  driver.tick(3000);
  assert.deepEqual(completions, [{ state: 'success' }]);
  assert.equal(driver.setState('thinking', { speed: Infinity }, 3100).speed, 1);
});
