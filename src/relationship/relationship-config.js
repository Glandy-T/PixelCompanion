const RELATIONSHIP_ACTIONS = Object.freeze(['single-click', 'double-click', 'pat', 'hello', 'surprise']);

const DEFAULT_RELATIONSHIP_CONFIG = Object.freeze({
  minimumInteractionIntervalMs: 750,
  initialBond: 0.2,
  bondDelta: Object.freeze({
    'single-click': 0.003,
    'double-click': 0.006,
    pat: 0.01,
    hello: 0.008,
    surprise: 0.005
  }),
  familiarityScale: 40
});

function mergeRelationshipConfig(config = {}) {
  return {
    ...DEFAULT_RELATIONSHIP_CONFIG,
    ...config,
    bondDelta: { ...DEFAULT_RELATIONSHIP_CONFIG.bondDelta, ...(config.bondDelta ?? {}) }
  };
}

module.exports = { DEFAULT_RELATIONSHIP_CONFIG, RELATIONSHIP_ACTIONS, mergeRelationshipConfig };
