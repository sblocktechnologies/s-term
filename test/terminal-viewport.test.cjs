const test = require('node:test');
const assert = require('node:assert/strict');

function buffer(lines, baseY) {
  return {
    baseY,
    length: lines.length,
    getLine: (index) => index >= 0 && index < lines.length
      ? { translateToString: () => lines[index] }
      : undefined,
  };
}

test('aligns an inline editor border with the bottom of the viewport', async () => {
  const { contentAlignedViewport } = await import('../src/terminalViewport.js');
  const lines = [
    ...Array.from({ length: 20 }, (_, index) => `history ${index}`),
    '────────────────────────',
    'prompt',
    '────────────────────────',
    '',
    '',
    '',
  ];
  assert.equal(contentAlignedViewport(buffer(lines, 10), 10), 10);
  assert.equal(contentAlignedViewport(buffer(lines, 20), 20), 3);
});

test('does not produce an invalid viewport for empty or short buffers', async () => {
  const { contentAlignedViewport } = await import('../src/terminalViewport.js');
  assert.equal(contentAlignedViewport(buffer(['', ''], 0), 10), null);
  assert.equal(contentAlignedViewport(buffer(['prompt', '', ''], 0), 10), 0);
  assert.equal(contentAlignedViewport(buffer(['prompt'], 0), 0), null);
});

test('ignores stale scrollback while the active TUI area is being redrawn', async () => {
  const { contentAlignedViewport } = await import('../src/terminalViewport.js');
  assert.equal(contentAlignedViewport(buffer(['history', 'older', '', '', ''], 2), 3), null);
  assert.equal(contentAlignedViewport(buffer(['history', '', 'prompt', '', ''], 2), 3), 0);
});
