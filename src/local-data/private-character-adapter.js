const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolvePrivateCharacterAsset } = require('./private-data-loader');

const PRIVATE_IMAGE_EXTENSIONS = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg', '.svg']);

function getPublicPlaceholderProfile() {
  return { source: 'placeholder', imageUrl: null };
}

function isSupportedPrivateImage(assetPath) {
  return typeof assetPath === 'string' && PRIVATE_IMAGE_EXTENSIONS.has(path.extname(assetPath).toLowerCase());
}

function createPrivateCharacterRendererProfile(options = {}) {
  const assetPath = resolvePrivateCharacterAsset('idle', options);
  const fileSystem = options.fileSystem ?? fs;
  if (!isSupportedPrivateImage(assetPath) || !fileSystem.existsSync(assetPath)) {
    return getPublicPlaceholderProfile();
  }

  return {
    source: 'private',
    // This URL is used only by the local pet renderer. It is never sent to the
    // Debug Window, persisted, logged, or uploaded.
    imageUrl: pathToFileURL(assetPath).href
  };
}

module.exports = {
  PRIVATE_IMAGE_EXTENSIONS,
  createPrivateCharacterRendererProfile,
  getPublicPlaceholderProfile,
  isSupportedPrivateImage
};
