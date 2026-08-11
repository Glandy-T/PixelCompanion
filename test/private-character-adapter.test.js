const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  createPrivateCharacterRendererProfile,
  getPublicPlaceholderProfile,
  isSupportedPrivateImage
} = require('../src/local-data/private-character-adapter');

function createFileSystem(files = {}) {
  return {
    existsSync: (filePath) => Object.prototype.hasOwnProperty.call(files, filePath),
    readFileSync: (filePath) => files[filePath]
  };
}

function createOptions(assetPath, exists = true) {
  const directory = path.resolve('D:\\PixelCompanionPrivate');
  const manifestPath = path.join(directory, 'character.manifest.json');
  const files = {
    [manifestPath]: JSON.stringify({ assets: { idle: assetPath } })
  };
  if (exists) {
    files[path.join(directory, assetPath)] = '';
  }
  return {
    privateDataDirectory: directory,
    repositoryRoot: path.resolve('C:\\project'),
    fileSystem: createFileSystem(files)
  };
}

function createAnimationOptions() {
  const directory = path.resolve('D:\\PixelCompanionPrivate');
  const manifestPath = path.join(directory, 'character.manifest.json');
  const frames = ['sprites/idle-0.png', 'sprites/idle-1.png'];
  const files = {
    [manifestPath]: JSON.stringify({
      version: 1,
      animations: { idle: { frames, frameDuration: 240, loop: true } }
    }),
    [path.join(directory, frames[0])]: '',
    [path.join(directory, frames[1])]: ''
  };
  return {
    privateDataDirectory: directory,
    repositoryRoot: path.resolve('C:\\project'),
    fileSystem: createFileSystem(files)
  };
}

test('private character adapter keeps the public placeholder when local data is absent or invalid', () => {
  assert.deepEqual(createPrivateCharacterRendererProfile({ environment: {}, repositoryRoot: path.resolve('C:\\project') }), getPublicPlaceholderProfile());
  assert.deepEqual(createPrivateCharacterRendererProfile(createOptions('sprites/idle.txt')), getPublicPlaceholderProfile());
  assert.deepEqual(createPrivateCharacterRendererProfile(createOptions('sprites/idle.png', false)), getPublicPlaceholderProfile());
});

test('private character adapter exposes only a local file URL for a valid manifest asset', () => {
  const profile = createPrivateCharacterRendererProfile(createOptions('sprites/idle.png'));
  assert.equal(profile.source, 'private');
  assert.match(profile.imageUrl, /^file:\/\//);
  assert.match(profile.imageUrl, /sprites\/idle\.png$/);
});

test('private character adapter accepts image formats and rejects unsupported files', () => {
  assert.equal(isSupportedPrivateImage('sprite.PNG'), true);
  assert.equal(isSupportedPrivateImage('sprite.webp'), true);
  assert.equal(isSupportedPrivateImage('sprite.txt'), false);
  assert.equal(isSupportedPrivateImage(null), false);
});

test('private character adapter prepares safe renderer frames from an external manifest', () => {
  const profile = createPrivateCharacterRendererProfile(createAnimationOptions());
  assert.equal(profile.source, 'private');
  assert.equal(profile.animations.idle.frames.length, 2);
  assert.equal(profile.animations.idle.frameDuration, 240);
  assert.equal(profile.animations.idle.loop, true);
  assert.match(profile.imageUrl, /idle-0\.png$/);
});
