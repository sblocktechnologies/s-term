const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('pins the xterm synchronized-output viewport fix', () => {
  const projectPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const xtermRoot = path.join(root, 'node_modules', '@xterm', 'xterm');
  const installedPackage = JSON.parse(fs.readFileSync(path.join(xtermRoot, 'package.json'), 'utf8'));
  const viewportSource = fs.readFileSync(path.join(xtermRoot, 'src', 'browser', 'Viewport.ts'), 'utf8');

  assert.equal(projectPackage.dependencies['@xterm/xterm'], '6.1.0-beta.291');
  assert.equal(installedPackage.version, '6.1.0-beta.291');
  assert.match(viewportSource, /Defer DOM scroll updates during synchronized output/);
  assert.match(viewportSource, /decPrivateModes\.synchronizedOutput/);
});
