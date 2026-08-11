const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  PRIVATE_DATA_DIR_ENV,
  isSafeRelativeAssetPath,
  loadPrivateCharacterManifest,
  loadPrivatePersonalityConfig,
  resolvePrivateCharacterAsset,
  resolvePrivateDataDirectory
} = require('../src/local-data/private-data-loader');

function createFileSystem(files = {}) {
  return {
    existsSync: (filePath) => Object.prototype.hasOwnProperty.call(files, filePath),
    readFileSync: (filePath) => files[filePath]
  };
}

test('private data remains disabled until an external directory is explicitly configured', () => {
  assert.equal(resolvePrivateDataDirectory({ environment: {}, repositoryRoot: 'C:\\project' }), null);
  assert.equal(resolvePrivateDataDirectory({
    environment: { [PRIVATE_DATA_DIR_ENV]: 'C:\\project\\private' },
    repositoryRoot: 'C:\\project'
  }), null);
});

test('private personality data is read only from the configured external directory', () => {
  const directory = path.resolve('D:\\PixelCompanionPrivate');
  const filePath = path.join(directory, 'personality.json');
  const result = loadPrivatePersonalityConfig({
    privateDataDirectory: directory,
    repositoryRoot: path.resolve('C:\\project'),
    fileSystem: createFileSystem({ [filePath]: JSON.stringify({ traits: { warmth: 0.9, curiosity: 0.2 } }) })
  });

  assert.deepEqual(result, {
    loaded: true,
    config: { defaultTraits: { warmth: 0.9, curiosity: 0.2 } },
    reason: null
  });
});

test('invalid or missing private personality data safely falls back without leaking content', () => {
  const directory = path.resolve('D:\\PixelCompanionPrivate');
  const filePath = path.join(directory, 'personality.json');
  const malformed = loadPrivatePersonalityConfig({
    privateDataDirectory: directory,
    repositoryRoot: path.resolve('C:\\project'),
    fileSystem: createFileSystem({ [filePath]: '{not json' })
  });

  assert.deepEqual(malformed, { loaded: false, config: null, reason: 'unreadable' });
});

test('private character manifest only resolves safe relative assets outside the repository', () => {
  const directory = path.resolve('D:\\PixelCompanionPrivate');
  const manifestPath = path.join(directory, 'character.manifest.json');
  const options = {
    privateDataDirectory: directory,
    repositoryRoot: path.resolve('C:\\project'),
    fileSystem: createFileSystem({ [manifestPath]: JSON.stringify({ assets: { idle: 'sprites/idle.png', unsafe: '../outside.png' } }) })
  };

  assert.equal(loadPrivateCharacterManifest(options).loaded, true);
  assert.equal(resolvePrivateCharacterAsset('idle', options), path.join(directory, 'sprites/idle.png'));
  assert.equal(resolvePrivateCharacterAsset('unsafe', options), null);
  assert.equal(isSafeRelativeAssetPath('sprites/idle.png'), true);
  assert.equal(isSafeRelativeAssetPath('../outside.png'), false);
});
