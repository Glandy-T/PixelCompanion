const fs = require('node:fs');
const path = require('node:path');

const PRIVATE_DATA_DIR_ENV = 'PIXEL_COMPANION_PRIVATE_DATA_DIR';
const PRIVATE_CHARACTER_MANIFEST_FILE = 'character.manifest.json';
const PRIVATE_PERSONALITY_FILE = 'personality.json';

function isOutsideRepository(directory, repositoryRoot) {
  const relativePath = path.relative(repositoryRoot, directory);
  return relativePath !== '' && (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

function resolvePrivateDataDirectory(options = {}) {
  const environment = options.environment ?? process.env;
  const configuredDirectory = options.privateDataDirectory ?? environment[PRIVATE_DATA_DIR_ENV];
  if (typeof configuredDirectory !== 'string' || configuredDirectory.trim() === '') {
    return null;
  }

  const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
  const resolvedDirectory = path.resolve(configuredDirectory);
  return isOutsideRepository(resolvedDirectory, repositoryRoot) ? resolvedDirectory : null;
}

function readPrivateJson(fileName, options = {}) {
  const directory = resolvePrivateDataDirectory(options);
  const fileSystem = options.fileSystem ?? fs;
  if (!directory) {
    return { loaded: false, value: null, reason: 'not-configured' };
  }

  const filePath = path.join(directory, fileName);
  try {
    if (!fileSystem.existsSync(filePath)) {
      return { loaded: false, value: null, reason: 'not-found' };
    }

    return { loaded: true, value: JSON.parse(fileSystem.readFileSync(filePath, 'utf8')), reason: null };
  } catch {
    // Never log or surface local file contents. A malformed private file is an
    // optional-data failure and must not affect the public application.
    return { loaded: false, value: null, reason: 'unreadable' };
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function loadPrivatePersonalityConfig(options = {}) {
  const result = readPrivateJson(PRIVATE_PERSONALITY_FILE, options);
  if (!result.loaded || !isPlainObject(result.value?.traits)) {
    return { loaded: false, config: null, reason: result.loaded ? 'invalid-schema' : result.reason };
  }

  return {
    loaded: true,
    // Only trait values are passed to the existing personality schema. The
    // source path and raw document remain private and are never exposed.
    config: { defaultTraits: { ...result.value.traits } },
    reason: null
  };
}

function isSafeRelativeAssetPath(assetPath) {
  if (typeof assetPath !== 'string' || assetPath.trim() === '' || path.isAbsolute(assetPath)) {
    return false;
  }

  const normalizedPath = path.normalize(assetPath);
  return normalizedPath !== '..' && !normalizedPath.startsWith(`..${path.sep}`);
}

function loadPrivateCharacterManifest(options = {}) {
  const result = readPrivateJson(PRIVATE_CHARACTER_MANIFEST_FILE, options);
  const hasAssets = isPlainObject(result.value?.assets);
  const hasAnimations = isPlainObject(result.value?.animations);
  if (!result.loaded || (!hasAssets && !hasAnimations)) {
    return { loaded: false, manifest: null, reason: result.loaded ? 'invalid-schema' : result.reason };
  }

  return {
    loaded: true,
    manifest: {
      version: Number.isInteger(result.value.version) ? result.value.version : 1,
      assets: hasAssets ? { ...result.value.assets } : {},
      animations: hasAnimations ? { ...result.value.animations } : {}
    },
    reason: null
  };
}

function resolvePrivateCharacterAsset(assetKey, options = {}) {
  const directory = resolvePrivateDataDirectory(options);
  const manifestResult = loadPrivateCharacterManifest(options);
  const assetPath = manifestResult.manifest?.assets?.[assetKey];
  if (!directory || !isSafeRelativeAssetPath(assetPath)) {
    return null;
  }

  return path.join(directory, assetPath);
}

module.exports = {
  PRIVATE_CHARACTER_MANIFEST_FILE,
  PRIVATE_DATA_DIR_ENV,
  PRIVATE_PERSONALITY_FILE,
  isSafeRelativeAssetPath,
  loadPrivateCharacterManifest,
  loadPrivatePersonalityConfig,
  readPrivateJson,
  resolvePrivateCharacterAsset,
  resolvePrivateDataDirectory
};
