const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chooseLocalReaction, chooseTone } = require('../src/interactions/personality-reactions');
const { buildPetMenuTemplate } = require('../src/interactions/pet-menu');

test('personality reaction tone is selected entirely from local traits', () => {
  assert.equal(chooseTone({ warmth: 0.95, protectiveness: 0.8, playfulness: 0.1, seriousness: 0.2 }), 'warm');
  assert.equal(chooseTone({ warmth: 0.1, playfulness: 0.95, curiosity: 0.9, seriousness: 0.1 }), 'playful');
  assert.equal(chooseTone({ warmth: 0.1, playfulness: 0.05, seriousness: 0.95 }), 'reserved');
  assert.deepEqual(chooseLocalReaction('hello', { warmth: 1 }, () => 0), {
    action: 'hello',
    tone: 'warm',
    message: 'Good to see you.'
  });
});

test('detailed pet menu separates interactions from application controls', () => {
  const interactions = [];
  const menu = buildPetMenuTemplate({
    currentState: 'thinking',
    alwaysOnTop: true,
    debugEnabled: true,
    onInteraction: (action) => interactions.push(action)
  });
  assert.equal(menu[0].label, 'Status: thinking');
  assert.equal(menu[1].label, 'Interact');
  assert.equal(menu[1].submenu.length, 3);
  menu[1].submenu[0].click();
  assert.deepEqual(interactions, ['pat']);
  assert.equal(menu.find((item) => item.label === 'Always on Top').checked, true);
  assert.ok(menu.some((item) => item.label === 'Toggle Debug Window'));
  assert.equal(menu.at(-1).label, 'Quit');
});

test('quick interaction toolbar is present without replacing the placeholder', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
  assert.match(html, /id="quick-actions"/);
  assert.match(html, /data-pet-action="pat"/);
  assert.match(html, /data-pet-action="hello"/);
  assert.match(html, /data-pet-action="more"/);
  assert.match(html, /assets\/characters\/placeholder\/placeholder-character\.svg/);
});
