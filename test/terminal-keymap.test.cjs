const test = require('node:test');
const assert = require('node:assert/strict');

function key(key, overrides = {}) {
  return {
    key,
    shiftKey: false,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    ...overrides,
  };
}

test('maps Pi editor shortcuts to unambiguous terminal sequences', async () => {
  const { getPiEditorSequence, PI_EDITOR_SEQUENCES, PI_IMAGE_PASTE_SEQUENCE } = await import('../src/terminal-keymap.js');
  assert.equal(PI_IMAGE_PASTE_SEQUENCE, '\x1b[118;6u');
  assert.equal(getPiEditorSequence(key('Enter', { shiftKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.newLine);
  assert.equal(getPiEditorSequence(key('ArrowLeft', { metaKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.lineStart);
  assert.equal(getPiEditorSequence(key('ArrowRight', { metaKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.lineEnd);
  assert.equal(getPiEditorSequence(key('ArrowUp', { metaKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.messageStart);
  assert.equal(getPiEditorSequence(key('ArrowDown', { metaKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.messageEnd);
  assert.equal(getPiEditorSequence(key('Backspace', { metaKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.clearDraft);
  assert.equal(getPiEditorSequence(key('ArrowLeft', { altKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.wordLeft);
  assert.equal(getPiEditorSequence(key('ArrowRight', { altKey: true }), 'darwin'), PI_EDITOR_SEQUENCES.wordRight);
});

test('does not intercept plain keys, mixed modifiers, or non-macOS terminals', async () => {
  const { getPiEditorSequence } = await import('../src/terminal-keymap.js');
  assert.equal(getPiEditorSequence(key('Enter'), 'darwin'), null);
  assert.equal(getPiEditorSequence(key('ArrowLeft'), 'darwin'), null);
  assert.equal(getPiEditorSequence(key('ArrowLeft', { altKey: true, shiftKey: true }), 'darwin'), null);
  assert.equal(getPiEditorSequence(key('Backspace', { metaKey: true, shiftKey: true }), 'darwin'), null);
  assert.equal(getPiEditorSequence(key('Enter', { shiftKey: true }), 'linux'), '\x1b[13;2u');
  assert.equal(getPiEditorSequence(key('ArrowLeft', { altKey: true }), 'linux'), null);
});
