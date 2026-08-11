const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  isSafeRelativeAssetPath,
  loadPrivateCharacterManifest,
  resolvePrivateDataDirectory
} = require('./private-data-loader');

const PRIVATE_IMAGE_EXTENSIONS = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg', '.svg']);
const PRIVATE_ANIMATION_STATES = Object.freeze(['idle', 'thinking', 'working', 'waiting', 'success', 'alert', 'sleepy']);

function getPublicPlaceholderProfile() {
  return { source: 'placeholder', imageUrl: null, animations: {} };
}

function isSupportedPrivateImage(assetPath) {
  return typeof assetPath === 'string' && PRIVATE_IMAGE_EXTENSIONS.has(path.extname(assetPath).toLowerCase());
}

function clampNumber(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function resolvePrivateImage(relativePath, directory, fileSystem) {
  if (!isSafeRelativeAssetPath(relativePath)) {
    return null;
  }
  const assetPath = path.join(directory, relativePath);
  return isSupportedPrivateImage(assetPath) && fileSystem.existsSync(assetPath) ? pathToFileURL(assetPath).href : null;
}

function normalizeAnimation(definition, directory, fileSystem) {
  if (!definition || typeof definition !== 'object' || !Array.isArray(definition.frames)) {
    return null;
  }
  const frames = definition.frames
    .slice(0, 120)
    .map((frame) => resolvePrivateImage(frame, directory, fileSystem));
  if (frames.length === 0 || frames.some((frame) => !frame)) {
    return null;
  }
  return {
    frames,
    frameDuration: Math.round(clampNumber(definition.frameDuration, 50, 10000, 500)),
    loop: definition.loop !== false
  };
}

function createPrivateCharacterRendererProfile(options = {}) {
  const directory = resolvePrivateDataDirectory(options);
  const manifestResult = loadPrivateCharacterManifest(options);
  const fileSystem = options.fileSystem ?? fs;
  if (!directory || !manifestResult.loaded) {
    return getPublicPlaceholderProfile();
  }

  const animations = {};
  for (const state of PRIVATE_ANIMATION_STATES) {
    const animation = normalizeAnimation(manifestResult.manifest.animations[state], directory, fileSystem);
    if (animation) {
      animations[state] = animation;
    }
  }

  const staticIdle = resolvePrivateImage(manifestResult.manifest.assets.idle, directory, fileSystem);
  const imageUrl = staticIdle ?? animations.idle?.frames[0] ?? Object.values(animations)[0]?.frames[0] ?? null;
  if (!imageUrl) {
    return getPublicPlaceholderProfile();
  }

  return {
    source: 'private',
    // This URL is used only by the local pet renderer. It is never sent to the
    // Debug Window, persisted, logged, or uploaded.
    imageUrl,
    animations
  };
}

module.exports = {
  PRIVATE_IMAGE_EXTENSIONS,
  PRIVATE_ANIMATION_STATES,
  createPrivateCharacterRendererProfile,
  getPublicPlaceholderProfile,
  isSupportedPrivateImage,
  normalizeAnimation
};
