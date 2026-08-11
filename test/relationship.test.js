const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/core/event-bus');
const {
  RELATIONSHIP_INTERACTION_RECORDED,
  RelationshipManager
} = require('../src/relationship/relationship-manager');
const { RelationshipStore } = require('../src/relationship/relationship-store');

function createMemoryStore(initialValue = null) {
  const files = new Map();
  if (initialValue !== null) {
    files.set('relationship.json', initialValue);
  }
  const fileSystem = {
    existsSync: (filePath) => files.has(filePath),
    readFileSync: (filePath) => files.get(filePath),
    mkdirSync: () => {},
    writeFileSync: (filePath, value) => files.set(filePath, value)
  };
  return { files, store: new RelationshipStore({ filePath: 'relationship.json', fileSystem }) };
}

test('relationship memory stores only a bounded local state schema', () => {
  const { files, store } = createMemoryStore();
  store.save({ bond: 0.5, familiarity: 0.3, interactionCount: 4, lastInteractionAt: 100, lastAction: 'pat', dialogue: 'private' });
  assert.deepEqual(Object.keys(JSON.parse(files.get('relationship.json'))).sort(), [
    'bond', 'familiarity', 'interactionCount', 'lastAction', 'lastInteractionAt', 'version'
  ]);
});

test('relationship manager records supported interactions and deduplicates rapid repeats', () => {
  let now = 1000;
  const bus = new EventBus();
  const events = [];
  const { store } = createMemoryStore();
  const manager = new RelationshipManager({ eventBus: bus, store, now: () => now });
  bus.on(RELATIONSHIP_INTERACTION_RECORDED, (event) => events.push(event.payload));
  const first = manager.recordInteraction('pat');
  const duplicate = manager.recordInteraction('pat');
  now += 800;
  const second = manager.recordInteraction('pat');
  assert.equal(first.accepted, true);
  assert.equal(duplicate.reason, 'interaction-cooldown');
  assert.equal(second.accepted, true);
  assert.equal(manager.getSnapshot().interactionCount, 2);
  assert.equal(events.length, 2);
});

test('relationship familiarity grows without controlling behavior', () => {
  let now = 0;
  const manager = new RelationshipManager({
    eventBus: new EventBus(),
    now: () => (now += 1000),
    config: { minimumInteractionIntervalMs: 0 }
  });
  const before = manager.getSnapshot();
  manager.recordInteraction('hello');
  const after = manager.getSnapshot();
  assert.ok(after.bond > before.bond);
  assert.ok(after.familiarity > before.familiarity);
  assert.equal(after.persistence, 'local-only');
  assert.equal(after.storesContent, false);
  assert.equal(Object.hasOwn(after, 'behavior'), false);
});

test('malformed local relationship state falls back safely', () => {
  const { store } = createMemoryStore('{bad json');
  assert.equal(store.load().interactionCount, 0);
  assert.equal(store.load().bond, 0.2);
});
