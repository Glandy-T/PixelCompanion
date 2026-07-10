const CATEGORY_RULES = Object.freeze([
  { category: 'conversation', names: ['chatgpt'] },
  { category: 'creative-3d', names: ['blender'] },
  { category: 'development', names: ['code', 'code-insiders', 'devenv', 'visualstudio'] },
  { category: 'leisure', names: ['steam'] },
  { category: 'browsing', names: ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'opera_gx'] }
]);

function normalizeProcessName(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\.exe$/i, '').toLowerCase();
}

function categorizeApp(processName) {
  const normalizedName = normalizeProcessName(processName);
  const rule = CATEGORY_RULES.find((candidate) => candidate.names.includes(normalizedName));

  return {
    processName: normalizedName || 'unknown',
    category: rule?.category ?? 'other'
  };
}

module.exports = {
  CATEGORY_RULES,
  categorizeApp,
  normalizeProcessName
};
