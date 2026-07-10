const PERSONALITY_TRAITS = Object.freeze([
  'warmth',
  'curiosity',
  'playfulness',
  'confidence',
  'protectiveness',
  'seriousness'
]);

const DEFAULT_PERSONALITY_TRAITS = Object.freeze({
  warmth: 0.6,
  curiosity: 0.5,
  playfulness: 0.45,
  confidence: 0.5,
  protectiveness: 0.45,
  seriousness: 0.5
});

function clampPersonalityValue(value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, numericValue));
}

function normalizePersonalityTraits(values = {}, fallbacks = DEFAULT_PERSONALITY_TRAITS) {
  return Object.fromEntries(PERSONALITY_TRAITS.map((trait) => [
    trait,
    clampPersonalityValue(values[trait], fallbacks[trait])
  ]));
}

function mergePersonalityConfig(config = {}) {
  return {
    defaultTraits: normalizePersonalityTraits(config.defaultTraits)
  };
}

module.exports = {
  DEFAULT_PERSONALITY_TRAITS,
  PERSONALITY_TRAITS,
  clampPersonalityValue,
  mergePersonalityConfig,
  normalizePersonalityTraits
};
