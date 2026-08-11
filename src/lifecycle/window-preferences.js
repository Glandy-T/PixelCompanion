const fs = require('node:fs');
const path = require('node:path');

const WINDOW_PREFERENCES_FILE = 'window-preferences.json';

function normalizeWindowPreferences(value = {}) {
  return {
    x: Number.isFinite(value.x) ? Math.round(value.x) : null,
    y: Number.isFinite(value.y) ? Math.round(value.y) : null,
    alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : true
  };
}

function intersectsWorkArea(position, workArea, windowSize, minimumVisible = 48) {
  const left = Math.max(position.x, workArea.x);
  const top = Math.max(position.y, workArea.y);
  const right = Math.min(position.x + windowSize.width, workArea.x + workArea.width);
  const bottom = Math.min(position.y + windowSize.height, workArea.y + workArea.height);
  return right - left >= minimumVisible && bottom - top >= minimumVisible;
}

function resolveWindowPosition(preferences, displays, windowSize = { width: 256, height: 256 }) {
  if (!Number.isFinite(preferences?.x) || !Number.isFinite(preferences?.y) || !displays?.length) {
    return null;
  }

  const savedPosition = { x: Math.round(preferences.x), y: Math.round(preferences.y) };
  if (displays.some((display) => intersectsWorkArea(savedPosition, display.workArea, windowSize))) {
    return savedPosition;
  }

  const primaryWorkArea = displays.find((display) => display.isPrimary)?.workArea ?? displays[0].workArea;
  return {
    x: primaryWorkArea.x + Math.max(0, primaryWorkArea.width - windowSize.width - 24),
    y: primaryWorkArea.y + Math.max(0, primaryWorkArea.height - windowSize.height - 24)
  };
}

class WindowPreferencesStore {
  constructor(options = {}) {
    this.filePath = options.filePath;
    this.fileSystem = options.fileSystem ?? fs;
  }

  load() {
    if (!this.filePath) {
      return normalizeWindowPreferences();
    }

    try {
      if (!this.fileSystem.existsSync(this.filePath)) {
        return normalizeWindowPreferences();
      }
      return normalizeWindowPreferences(JSON.parse(this.fileSystem.readFileSync(this.filePath, 'utf8')));
    } catch {
      return normalizeWindowPreferences();
    }
  }

  save(preferences) {
    const normalized = normalizeWindowPreferences(preferences);
    if (!this.filePath) {
      return normalized;
    }

    try {
      this.fileSystem.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this.fileSystem.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2), 'utf8');
    } catch {
      // Window preferences are optional local state and must never prevent exit.
    }
    return normalized;
  }
}

module.exports = {
  WINDOW_PREFERENCES_FILE,
  WindowPreferencesStore,
  intersectsWorkArea,
  normalizeWindowPreferences,
  resolveWindowPosition
};
