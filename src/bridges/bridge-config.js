const path = require('node:path');
const os = require('node:os');

const DEFAULT_BRIDGE_CONFIG = Object.freeze({
  processObservation: Object.freeze({
    enabled: true,
    pollIntervalMs: 5000
  }),
  sqliteObservation: Object.freeze({
    enabled: false,
    experimental: true,
    pollIntervalMs: 5000,
    stateFileName: 'state_5.sqlite'
  })
});

function mergeBridgeConfig(config = {}) {
  return {
    processObservation: {
      ...DEFAULT_BRIDGE_CONFIG.processObservation,
      ...config.processObservation
    },
    sqliteObservation: {
      ...DEFAULT_BRIDGE_CONFIG.sqliteObservation,
      ...config.sqliteObservation
    }
  };
}

function resolveCodexStatePath(config = {}) {
  const merged = mergeBridgeConfig(config);
  return path.join(os.homedir(), '.codex', merged.sqliteObservation.stateFileName);
}

module.exports = {
  DEFAULT_BRIDGE_CONFIG,
  mergeBridgeConfig,
  resolveCodexStatePath
};
