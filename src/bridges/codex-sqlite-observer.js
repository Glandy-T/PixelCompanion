const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { AI_BRIDGE_EVENTS } = require('./bridge-events');
const { resolveCodexStatePath } = require('./bridge-config');

const OBSERVED_TABLES = Object.freeze(['agent_jobs', 'agent_job_items']);
const SAFE_COLUMNS = Object.freeze(['id', 'status', 'created_at', 'updated_at']);

function sanitizeStatus(value) {
  if (typeof value !== 'string') {
    return 'non-string-status';
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) || 'empty-status';
}

function createTableSnapshot(name, columns = []) {
  const availableColumns = columns.filter((column) => SAFE_COLUMNS.includes(column));
  return {
    available: columns.length > 0,
    statusAvailable: availableColumns.includes('status'),
    rowIdentityAvailable: availableColumns.includes('id'),
    columns: availableColumns
  };
}

class CodexSqliteObserver {
  constructor(options = {}) {
    this.enabled = options.enabled ?? false;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.resolveDatabasePath = options.resolveDatabasePath ?? (() => resolveCodexStatePath());
    this.fileExists = options.fileExists ?? fs.existsSync;
    this.fileStat = options.fileStat ?? fs.statSync;
    this.openDatabase = options.openDatabase ?? ((databasePath) => new DatabaseSync(databasePath, {
      readOnly: true,
      allowExtension: false
    }));
    this.emit = options.emit ?? (() => {});
    this.onUpdate = options.onUpdate ?? (() => {});
    this.setInterval = options.setIntervalFn ?? setInterval;
    this.clearInterval = options.clearIntervalFn ?? clearInterval;
    this.timer = null;
    this.rowsByKey = new Map();
    this.state = {
      enabled: this.enabled,
      schemaHealth: 'disabled',
      databasePresent: false,
      agentJobs: createTableSnapshot('agent_jobs'),
      agentJobItems: createTableSnapshot('agent_job_items'),
      lastObservedStatus: null,
      rawUnknownStatus: null,
      lastObservedAt: null,
      lastError: null,
      pollingHealthy: true,
      validation: {
        agentJobsRowCount: 0,
        agentJobItemsRowCount: 0,
        databaseBytes: 0,
        walBytes: 0,
        shmBytes: 0,
        metadataChanged: false,
        observedAt: null
      }
    };
  }

  start() {
    if (!this.enabled || this.timer) {
      return;
    }

    this.observe();
    this.timer = this.setInterval(() => this.observe(), this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      this.clearInterval(this.timer);
      this.timer = null;
    }
  }

  setEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    if (this.enabled === nextEnabled) {
      return this.getSnapshot();
    }

    this.stop();
    this.enabled = nextEnabled;
    this.state.enabled = nextEnabled;
    this.rowsByKey.clear();
    if (!nextEnabled) {
      this.state.schemaHealth = 'disabled';
      this.state.lastError = null;
      this.state.lastObservedStatus = null;
      this.state.rawUnknownStatus = null;
      this.onUpdate(this.getSnapshot());
      return this.getSnapshot();
    }

    this.start();
    return this.getSnapshot();
  }

  observe() {
    if (!this.enabled) {
      return this.getSnapshot();
    }

    let database;
    try {
      const databasePath = this.resolveDatabasePath();
      this.state.databasePresent = Boolean(databasePath && this.fileExists(databasePath));
      if (!this.state.databasePresent) {
        this.setFallback('database-not-found');
        return this.getSnapshot();
      }

      database = this.openDatabase(databasePath);
      const schema = this.discoverSchema(database);
      this.state.agentJobs = schema.agentJobs;
      this.state.agentJobItems = schema.agentJobItems;
      if (!schema.healthy) {
        this.setFallback('schema-not-supported');
        return this.getSnapshot();
      }

      this.state.schemaHealth = 'healthy';
      this.state.lastError = null;
      this.state.pollingHealthy = true;
      const agentJobsRowCount = this.observeTableRows(database, 'agent_jobs', schema.agentJobs.columns);
      const agentJobItemsRowCount = this.observeTableRows(database, 'agent_job_items', schema.agentJobItems.columns);
      this.updateValidation(databasePath, agentJobsRowCount, agentJobItemsRowCount);
      this.state.lastObservedAt = this.state.validation.observedAt;
    } catch {
      this.setFallback('sqlite-read-unavailable');
    } finally {
      database?.close?.();
      this.onUpdate(this.getSnapshot());
    }

    return this.getSnapshot();
  }

  discoverSchema(database) {
    const names = new Set(database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('agent_jobs', 'agent_job_items')"
    ).all().map((row) => row.name));
    const readColumns = (tableName) => {
      if (!names.has(tableName)) {
        return [];
      }

      return database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
    };
    const agentJobs = createTableSnapshot('agent_jobs', readColumns('agent_jobs'));
    const agentJobItems = createTableSnapshot('agent_job_items', readColumns('agent_job_items'));
    return {
      agentJobs,
      agentJobItems,
      healthy: agentJobs.statusAvailable && agentJobItems.statusAvailable
    };
  }

  observeTableRows(database, tableName, columns) {
    const selectedColumns = columns.filter((column) => SAFE_COLUMNS.includes(column));
    if (!selectedColumns.includes('status')) {
      return 0;
    }

    const usesRowIdentity = selectedColumns.includes('id');
    const rows = usesRowIdentity
      ? database.prepare(`SELECT ${selectedColumns.join(', ')} FROM ${tableName}`).all()
      : database.prepare(
        `SELECT status, COUNT(*) AS status_count, MAX(updated_at) AS updated_at, MAX(created_at) AS created_at FROM ${tableName} GROUP BY status`
      ).all();
    for (const row of rows) {
      const rowKey = usesRowIdentity ? `${tableName}:${String(row.id)}` : `${tableName}:${String(row.status)}`;
      const status = sanitizeStatus(row.status);
      const fingerprint = `${status}:${row.status_count ?? ''}:${row.updated_at ?? row.created_at ?? ''}`;
      if (this.rowsByKey.get(rowKey) === fingerprint) {
        continue;
      }

      this.rowsByKey.set(rowKey, fingerprint);
      this.state.lastObservedStatus = status;
      this.state.rawUnknownStatus = status;
      this.emit(AI_BRIDGE_EVENTS.CODEX_ACTIVITY_DETECTED, { table: tableName });
      this.emit(AI_BRIDGE_EVENTS.CODEX_JOB_CHANGED, { table: tableName });
      this.emit(AI_BRIDGE_EVENTS.CODEX_JOB_UNKNOWN, { table: tableName });
    }

    return rows.length;
  }

  updateValidation(databasePath, agentJobsRowCount, agentJobItemsRowCount) {
    const getSize = (filePath) => {
      try {
        return this.fileStat(filePath).size;
      } catch {
        return 0;
      }
    };
    const next = {
      agentJobsRowCount,
      agentJobItemsRowCount,
      databaseBytes: getSize(databasePath),
      walBytes: getSize(`${databasePath}-wal`),
      shmBytes: getSize(`${databasePath}-shm`),
      metadataChanged: false,
      observedAt: Date.now()
    };
    const previous = this.state.validation;
    next.metadataChanged = previous.observedAt !== null && (
      previous.agentJobsRowCount !== next.agentJobsRowCount ||
      previous.agentJobItemsRowCount !== next.agentJobItemsRowCount ||
      previous.databaseBytes !== next.databaseBytes ||
      previous.walBytes !== next.walBytes ||
      previous.shmBytes !== next.shmBytes
    );
    this.state.validation = next;
  }

  setFallback(errorCode) {
    this.state.schemaHealth = 'fallback';
    this.state.lastError = errorCode;
    this.state.pollingHealthy = false;
  }

  getSnapshot() {
    return {
      enabled: this.state.enabled,
      experimental: true,
      schemaHealth: this.state.schemaHealth,
      databasePresent: this.state.databasePresent,
      agentJobs: { ...this.state.agentJobs, columns: [...this.state.agentJobs.columns] },
      agentJobItems: { ...this.state.agentJobItems, columns: [...this.state.agentJobItems.columns] },
      lastObservedStatus: this.state.lastObservedStatus,
      rawUnknownStatus: this.state.rawUnknownStatus,
      lastObservedAt: this.state.lastObservedAt,
      lastError: this.state.lastError,
      pollingHealthy: this.state.pollingHealthy,
      validation: { ...this.state.validation }
    };
  }

  health() {
    return this.getSnapshot();
  }
}

module.exports = {
  CodexSqliteObserver,
  OBSERVED_TABLES,
  SAFE_COLUMNS,
  sanitizeStatus
};
