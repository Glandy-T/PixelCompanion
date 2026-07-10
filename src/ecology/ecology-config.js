const DEFAULT_ECOLOGY_CONFIG = Object.freeze({
  tickIntervalMs: 5000,
  memoryCapacity: 24,
  proactiveCooldownMs: 90000,
  dialogueCooldownMs: 180000,
  randomSeed: 90210,
  randomMode: 'seeded',
  maxDriveDelta: 0.12,
  defaultDrives: Object.freeze({
    energy: 0.68,
    curiosity: 0.46,
    attention: 0.5,
    socialDrive: 0.4,
    focus: 0.5,
    arousal: 0.3
  })
});

function mergeEcologyConfig(config = {}) {
  return {
    ...DEFAULT_ECOLOGY_CONFIG,
    ...config,
    defaultDrives: {
      ...DEFAULT_ECOLOGY_CONFIG.defaultDrives,
      ...config.defaultDrives
    }
  };
}

module.exports = {
  DEFAULT_ECOLOGY_CONFIG,
  mergeEcologyConfig
};
