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

test('dragged grid panes swap occupied positions or move into empty positions', async () => {
  const { swapGridSlots } = await import('../src/gridPlacement.js');
  assert.deepEqual(
    swapGridSlots(['one', 'two', 'three', 'four'], 'one', 3),
    ['four', 'two', 'three', 'one'],
  );
  assert.deepEqual(
    swapGridSlots(['one', null, 'three', 'four'], 'three', 1),
    ['one', 'three', null, 'four'],
  );
});
