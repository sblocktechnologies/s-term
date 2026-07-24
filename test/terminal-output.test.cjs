const test = require('node:test');
const assert = require('node:assert/strict');

test('preserves Pi scrollback during a synchronized full redraw', async () => {
  const { createTerminalOutputFilter, PI_FULL_REDRAW_CLEAR } = await import('../src/terminalOutput.js');
  const filter = createTerminalOutputFilter();
  const input = `before\x1b[?2026h${PI_FULL_REDRAW_CLEAR}content\x1b[?2026l`;
  assert.equal(
    filter.push(input, true),
    'before\x1b[?2026h\x1b[2J\x1b[Hcontent\x1b[?2026l',
  );
  assert.equal(filter.flush(), '');
});

test('recognizes Pi full redraws split across arbitrary PTY chunks', async () => {
  const { createTerminalOutputFilter, PI_FULL_REDRAW_CLEAR } = await import('../src/terminalOutput.js');
  const input = `prefix${PI_FULL_REDRAW_CLEAR}suffix`;
  const expected = 'prefix\x1b[2J\x1b[Hsuffix';

  for (let split = 1; split < input.length; split += 1) {
    const filter = createTerminalOutputFilter();
    const output = filter.push(input.slice(0, split), true) +
      filter.push(input.slice(split), true) + filter.flush();
    assert.equal(output, expected, `split at ${split}`);
  }
});

test('leaves normal terminal output and standalone clear sequences unchanged', async () => {
  const { createTerminalOutputFilter, PI_FULL_REDRAW_CLEAR } = await import('../src/terminalOutput.js');
  const normal = createTerminalOutputFilter();
  assert.equal(normal.push(PI_FULL_REDRAW_CLEAR, false), PI_FULL_REDRAW_CLEAR);

  const pi = createTerminalOutputFilter();
  assert.equal(pi.push('before\x1b[3Jafter', true), 'before\x1b[3Jafter');
});
