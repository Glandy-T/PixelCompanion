const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const packageJson = require('../package.json');

test('Windows packaging includes only public application code and placeholder assets', () => {
  assert.equal(packageJson.scripts.pack, 'electron-builder --dir');
  assert.equal(packageJson.scripts.dist, 'electron-builder --win portable');
  assert.deepEqual(packageJson.build.files, [
    'src/**/*',
    'assets/characters/placeholder/**/*',
    'package.json'
  ]);
  assert.equal(packageJson.build.files.some((entry) => /private|local-assets|docs/i.test(entry)), false);
  assert.deepEqual(packageJson.build.win.target, ['portable']);
});

test('repository ignores every private character directory except the public placeholder', () => {
  const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(gitignore, /^assets\/characters\/\*\/$/m);
  assert.match(gitignore, /^!assets\/characters\/placeholder\/$/m);
  assert.match(gitignore, /^!assets\/characters\/placeholder\/\*\*$/m);
});
