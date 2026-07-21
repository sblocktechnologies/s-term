export const PI_IMAGE_PASTE_SEQUENCE = '\x1b[118;6u';

export const PI_EDITOR_SEQUENCES = Object.freeze({
  newLine: '\x1b[13;2u',
  lineStart: '\x1bOH',
  lineEnd: '\x1bOF',
  messageStart: '\x1b[7^',
  messageEnd: '\x1b[8^',
  wordLeft: '\x1b[1;3D',
  wordRight: '\x1b[1;3C',
  clearDraft: '\x1b[127;6u',
});

/**
 * Translate macOS-style editor shortcuts to sequences Pi understands.
 * Returns null when S-Term should leave the key to xterm.
 */
export function getPiEditorSequence(event, platform) {
  if (!event) return null;
  const key = String(event.key || '').toLowerCase().replace(/^arrow/, '');

  if (key === 'enter' && event.shiftKey && !event.metaKey && !event.altKey && !event.ctrlKey) {
    return PI_EDITOR_SEQUENCES.newLine;
  }

  if (platform !== 'darwin') return null;

  if (event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) {
    if (key === 'left') return PI_EDITOR_SEQUENCES.lineStart;
    if (key === 'right') return PI_EDITOR_SEQUENCES.lineEnd;
    if (key === 'up') return PI_EDITOR_SEQUENCES.messageStart;
    if (key === 'down') return PI_EDITOR_SEQUENCES.messageEnd;
    if (key === 'backspace') return PI_EDITOR_SEQUENCES.clearDraft;
  }

  if (event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    if (key === 'left') return PI_EDITOR_SEQUENCES.wordLeft;
    if (key === 'right') return PI_EDITOR_SEQUENCES.wordRight;
  }

  return null;
}
