const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivateFramePlayer } = require('../src/animation/private-frame-player');

function snapshot(state) {
  return { animation: { id: state } };
}

test('private frame player advances looped frames independently from placeholder CSS animation', () => {
  const image = { src: '' };
  const player = new PrivateFramePlayer({ image });
  player.setProfile({
    source: 'private',
    animations: { idle: { frames: ['one.png', 'two.png'], frameDuration: 100, loop: true } }
  });
  assert.equal(player.apply(snapshot('idle'), 0).frameIndex, 0);
  assert.equal(image.src, 'one.png');
  assert.equal(player.apply(snapshot('idle'), 100).frameIndex, 1);
  assert.equal(image.src, 'two.png');
  assert.equal(player.apply(snapshot('idle'), 200).frameIndex, 0);
});

test('private frame player holds non-looping final frames and falls back to idle per state', () => {
  const image = { src: '' };
  const player = new PrivateFramePlayer({ image });
  player.setProfile({
    source: 'private',
    animations: { idle: { frames: ['one.png', 'two.png'], frameDuration: 50, loop: false } }
  });
  player.apply(snapshot('working'), 0);
  const final = player.apply(snapshot('working'), 200);
  assert.equal(final.frameIndex, 1);
  assert.equal(image.src, 'two.png');
});

test('private frame player leaves the public placeholder untouched without a private profile', () => {
  const image = { src: 'placeholder.svg' };
  const player = new PrivateFramePlayer({ image });
  const result = player.apply(snapshot('idle'), 0);
  assert.equal(result.source, 'placeholder');
  assert.equal(image.src, 'placeholder.svg');
});
