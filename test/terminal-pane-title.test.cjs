const test = require('node:test');
const assert = require('node:assert/strict');

test('keeps the custom terminal name visible when the PTY title changes', async () => {
  const { terminalPaneTitle } = await import('../src/terminalPaneTitle.js');
  assert.deepEqual(terminalPaneTitle('AI400', 'zsh /Users/air'), {
    label: 'AI400',
    tooltip: 'AI400 · zsh /Users/air',
  });
});

test('does not duplicate an unchanged terminal title in the tooltip', async () => {
  const { terminalPaneTitle } = await import('../src/terminalPaneTitle.js');
  assert.deepEqual(terminalPaneTitle('KNY PC', 'KNY PC'), {
    label: 'KNY PC',
    tooltip: 'KNY PC',
  });
});
