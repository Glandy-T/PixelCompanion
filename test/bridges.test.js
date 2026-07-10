const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/core/event-bus');
const { AI_BRIDGE_EVENTS, createBridgeEvent } = require('../src/bridges/bridge-events');
const { ChatGPTProcessBridge } = require('../src/bridges/chatgpt-process-bridge');
const { CodexProcessBridge } = require('../src/bridges/codex-process-bridge');
const { CodexSqliteObserver } = require('../src/bridges/codex-sqlite-observer');
const { BridgeManager } = require('../src/bridges/bridge-manager');

function createFakeDatabase(options = {}) {
  const tables = options.tables ?? ['agent_jobs', 'agent_job_items'];
  const columns = options.columns ?? {
    agent_jobs: ['id', 'status', 'created_at', 'updated_at'],
    agent_job_items: ['id', 'status', 'created_at', 'updated_at']
  };
  const rows = options.rows ?? { agent_jobs: [], agent_job_items: [] };

  return {
    prepare(statement) {
      return {
        all() {
          if (statement.includes('sqlite_master')) {
            return tables.map((name) => ({ name }));
          }
          const pragma = statement.match(/PRAGMA table_info\(([^)]+)\)/);
          if (pragma) {
            return (columns[pragma[1]] ?? []).map((name) => ({ name }));
          }
          const selected = statement.match(/FROM (agent_jobs|agent_job_items)/);
          return selected ? (rows[selected[1]] ?? []) : [];
        }
      };
    },
    close() {}
  };
}

function createBridgeFake(snapshot) {
  return {
    start() {},
    stop() {},
    setEnabled() {},
    observeForeground() {},
    getSnapshot: () => snapshot,
    health: () => snapshot
  };
}

test('bridge events use the existing unified Event Bus format', () => {
  const event = createBridgeEvent(AI_BRIDGE_EVENTS.CHATGPT_STARTED, { sourceKind: 'process' }, {
    observedAt: 10,
    source: 'test'
  });

  assert.equal(event.type, 'ai.chatgpt.started');
  assert.equal(event.source, 'test');
  assert.deepEqual(event.payload, { observedAt: 10, sourceKind: 'process' });
  assert.throws(() => createBridgeEvent('ai.unknown'), /Unsupported bridge event/);
});

test('ChatGPT process bridge deduplicates process and foreground transitions', () => {
  const events = [];
  const bridge = new ChatGPTProcessBridge({ emit: (type) => events.push(type) });

  bridge.observeProcessNames(['ChatGPT.exe']);
  bridge.observeProcessNames(['ChatGPT.exe']);
  bridge.observeForeground('ChatGPT.exe');
  bridge.observeForeground('ChatGPT');
  bridge.observeForeground('Code.exe');
  bridge.observeForeground('Code.exe');
  bridge.observeProcessNames([]);

  assert.deepEqual(events, [
    AI_BRIDGE_EVENTS.CHATGPT_STARTED,
    AI_BRIDGE_EVENTS.CHATGPT_FOREGROUND,
    AI_BRIDGE_EVENTS.CHATGPT_BACKGROUND,
    AI_BRIDGE_EVENTS.CHATGPT_STOPPED
  ]);
  assert.equal(bridge.health().present, false);
});

test('Codex process bridge handles missing processes without emitting false transitions', () => {
  const events = [];
  const bridge = new CodexProcessBridge({ emit: (type) => events.push(type) });

  bridge.observeProcessNames([]);
  assert.equal(bridge.getSnapshot().present, false);
  assert.equal(bridge.getSnapshot().hostPresent, false);
  assert.deepEqual(events, []);
});

test('SQLite observer falls back safely when its database is missing', () => {
  const observer = new CodexSqliteObserver({
    enabled: true,
    resolveDatabasePath: () => 'missing.sqlite',
    fileExists: () => false
  });

  const snapshot = observer.observe();
  assert.equal(snapshot.schemaHealth, 'fallback');
  assert.equal(snapshot.lastError, 'database-not-found');
  assert.equal(snapshot.databasePresent, false);
});

test('SQLite observer falls back when a required status field is missing', () => {
  const observer = new CodexSqliteObserver({
    enabled: true,
    resolveDatabasePath: () => 'state.sqlite',
    fileExists: () => true,
    openDatabase: () => createFakeDatabase({
      columns: {
        agent_jobs: ['id', 'status'],
        agent_job_items: ['id', 'updated_at']
      }
    })
  });

  const snapshot = observer.observe();
  assert.equal(snapshot.schemaHealth, 'fallback');
  assert.equal(snapshot.lastError, 'schema-not-supported');
  assert.equal(snapshot.agentJobItems.statusAvailable, false);
});

test('SQLite observer treats unrecognized statuses as unknown without emitting raw status data', () => {
  const events = [];
  const observer = new CodexSqliteObserver({
    enabled: true,
    resolveDatabasePath: () => 'state.sqlite',
    fileExists: () => true,
    openDatabase: () => createFakeDatabase({
      rows: { agent_jobs: [{ id: 'job-1', status: 'paused-by-product', updated_at: 1 }], agent_job_items: [] }
    }),
    emit: (type, payload) => events.push({ type, payload })
  });

  const snapshot = observer.observe();
  assert.equal(snapshot.lastObservedStatus, 'paused-by-product');
  assert.equal(snapshot.rawUnknownStatus, 'paused-by-product');
  assert.deepEqual(events.map((event) => event.type), [
    AI_BRIDGE_EVENTS.CODEX_ACTIVITY_DETECTED,
    AI_BRIDGE_EVENTS.CODEX_JOB_CHANGED,
    AI_BRIDGE_EVENTS.CODEX_JOB_UNKNOWN
  ]);
  assert.deepEqual(events.at(-1).payload, { table: 'agent_jobs' });
});

test('SQLite observer can aggregate agent job item statuses when no single id column exists', () => {
  const events = [];
  const observer = new CodexSqliteObserver({
    enabled: true,
    resolveDatabasePath: () => 'state.sqlite',
    fileExists: () => true,
    openDatabase: () => createFakeDatabase({
      columns: {
        agent_jobs: ['id', 'status', 'updated_at'],
        agent_job_items: ['status', 'created_at', 'updated_at']
      },
      rows: { agent_jobs: [], agent_job_items: [{ status: 'observed-value', status_count: 1, updated_at: 2 }] }
    }),
    emit: (type) => events.push(type)
  });

  const snapshot = observer.observe();
  assert.equal(snapshot.agentJobItems.rowIdentityAvailable, false);
  assert.equal(snapshot.lastObservedStatus, 'observed-value');
  assert.equal(snapshot.validation.agentJobItemsRowCount, 1);
  assert.ok(events.includes(AI_BRIDGE_EVENTS.CODEX_JOB_UNKNOWN));
});

test('SQLite observer handles malformed schema reads without crashing', () => {
  const observer = new CodexSqliteObserver({
    enabled: true,
    resolveDatabasePath: () => 'state.sqlite',
    fileExists: () => true,
    openDatabase: () => {
      throw new Error('malformed');
    }
  });

  const snapshot = observer.observe();
  assert.equal(snapshot.schemaHealth, 'fallback');
  assert.equal(snapshot.lastError, 'sqlite-read-unavailable');
});

test('bridge manager selects process-only, process-plus-sqlite, and unavailable modes', () => {
  const healthyProcess = { present: true, foreground: false, healthy: true };
  const healthyCodex = { present: true, hostPresent: true, healthy: true };
  const healthySqlite = {
    enabled: true,
    schemaHealth: 'healthy',
    pollingHealthy: true,
    agentJobs: { available: true, statusAvailable: true, columns: [] },
    agentJobItems: { available: true, statusAvailable: true, columns: [] }
  };
  const manager = new BridgeManager({
    eventBus: new EventBus(),
    config: { sqliteObservation: { enabled: true } },
    chatgptBridge: createBridgeFake(healthyProcess),
    codexBridge: createBridgeFake(healthyCodex),
    sqliteObserver: createBridgeFake(healthySqlite)
  });
  assert.equal(manager.currentMode(), 'process-plus-sqlite');

  const fallbackManager = new BridgeManager({
    eventBus: new EventBus(),
    config: { sqliteObservation: { enabled: true } },
    chatgptBridge: createBridgeFake(healthyProcess),
    codexBridge: createBridgeFake(healthyCodex),
    sqliteObserver: createBridgeFake({ ...healthySqlite, schemaHealth: 'fallback', pollingHealthy: false })
  });
  assert.equal(fallbackManager.currentMode(), 'process-only');

  const unavailableManager = new BridgeManager({
    eventBus: new EventBus(),
    config: { processObservation: { enabled: false } },
    chatgptBridge: createBridgeFake(healthyProcess),
    codexBridge: createBridgeFake(healthyCodex),
    sqliteObserver: createBridgeFake(healthySqlite)
  });
  assert.equal(unavailableManager.currentMode(), 'unavailable');
});
