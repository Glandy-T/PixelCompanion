const fs = require('node:fs');
const path = require('node:path');
const { normalizeRelationshipState } = require('./relationship-state');

const RELATIONSHIP_STATE_FILE = 'relationship-state.json';

class RelationshipStore {
  constructor(options = {}) {
    this.filePath = options.filePath;
    this.fileSystem = options.fileSystem ?? fs;
    this.config = options.config ?? {};
  }

  load() {
    try {
      if (!this.filePath || !this.fileSystem.existsSync(this.filePath)) {
        return normalizeRelationshipState({}, this.config);
      }
      return normalizeRelationshipState(JSON.parse(this.fileSystem.readFileSync(this.filePath, 'utf8')), this.config);
    } catch {
      return normalizeRelationshipState({}, this.config);
    }
  }

  save(state) {
    const normalized = normalizeRelationshipState(state, this.config);
    try {
      if (this.filePath) {
        this.fileSystem.mkdirSync(path.dirname(this.filePath), { recursive: true });
        this.fileSystem.writeFileSync(this.filePath, JSON.stringify(normalized, null, 2), 'utf8');
      }
    } catch {
      // Relationship memory is optional, local-only state.
    }
    return normalized;
  }
}

module.exports = { RELATIONSHIP_STATE_FILE, RelationshipStore };
