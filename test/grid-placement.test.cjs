const test = require('node:test');
const assert = require('node:assert/strict');

test('new pane terminals prefer the first empty grid position', async () => {
  const { newTerminalGridSlot } = await import('../src/gridPlacement.js');
  assert.equal(newTerminalGridSlot(['one', null, 'three', null], 'three', 2), 1);
});

test('new pane terminals replace the clicked position when the grid is full', async () => {
  const { newTerminalGridSlot } = await import('../src/gridPlacement.js');
  assert.equal(newTerminalGridSlot(['one', 'two', 'three', 'four'], 'three', 0), 2);
  assert.equal(newTerminalGridSlot(['one', 'two', 'three', 'four'], 'missing', 3), 3);
});
