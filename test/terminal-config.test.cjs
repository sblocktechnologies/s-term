const test = require('node:test');
const assert = require('node:assert/strict');

test('retains enough xterm scrollback for large resumed Pi histories', async () => {
  const { TERMINAL_SCROLLBACK } = await import('../src/terminalConfig.js');
  assert.equal(TERMINAL_SCROLLBACK, 100_000);
  assert.ok(TERMINAL_SCROLLBACK >= 10 * 10_000);
});
