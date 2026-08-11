const fs = require('node:fs');
const path = require('node:path');

const APP_SETTINGS_FILE = 'app-settings.json';
const DEFAULT_APP_SETTINGS = Object.freeze({
  quickActionsEnabled: true,
  proactiveEcologyEnabled: true
});

function normalizeAppSettings(value = {}) {
  return {
    quickActionsEnabled: typeof value.quickActionsEnabled === 'boolean'
      ? value.quickActionsEnabled
      : DEFAULT_APP_SETTINGS.quickActionsEnabled,
    proactiveEcologyEnabled: typeof value.proactiveEcologyEnabled === 'boolean'
      ? value.proactiveEcologyEnabled
      : DEFAULT_APP_SETTINGS.proactiveEcologyEnabled
  };
}

class AppSettingsStore {
  constructor(options = {}) {
    this.filePath = options.filePath;
    this.fileSystem = options.fileSystem ?? fs;
  }

  load() {
    try {
      if (!this.filePath || !this.fileSystem.existsSync(this.filePath)) {
        return normalizeAppSettings();
      }
      return normalizeAppSettings(JSON.parse(this.fileSystem.readFileSync(this.filePath, 'utf8')));
    } catch {
      return normalizeAppSettings();
    }
  }

  save(settings) {
    const normalized = normalizeAppSettings(settings);
    try {
      if (this.filePath) {
        this.fileSystem.mkdirSync(path.dirname(this.filePath), { recursive: true });
        this.fileSystem.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2), 'utf8');
      }
    } catch {
      // Settings remain optional and local-only.
    }
    return normalized;
  }
}

module.exports = { APP_SETTINGS_FILE, AppSettingsStore, DEFAULT_APP_SETTINGS, normalizeAppSettings };
