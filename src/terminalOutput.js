export const PI_FULL_REDRAW_CLEAR = '\x1b[2J\x1b[H\x1b[3J';
const PI_FULL_REDRAW_PRESERVE_SCROLLBACK = '\x1b[2J\x1b[H';

function partialSequenceLength(value, sequence) {
  const maximum = Math.min(value.length, sequence.length - 1);
  for (let length = maximum; length > 0; length -= 1) {
    if (value.endsWith(sequence.slice(0, length))) return length;
  }
  return 0;
}

export function createTerminalOutputFilter() {
  let pending = '';
  return {
    push(data, preservePiScrollback) {
      const combined = pending + data;
      pending = '';
      if (!preservePiScrollback) return combined;

      const partialLength = partialSequenceLength(combined, PI_FULL_REDRAW_CLEAR);
      const complete = partialLength > 0 ? combined.slice(0, -partialLength) : combined;
      if (partialLength > 0) pending = combined.slice(-partialLength);
      return complete.replaceAll(PI_FULL_REDRAW_CLEAR, PI_FULL_REDRAW_PRESERVE_SCROLLBACK);
    },
    flush() {
      const trailing = pending;
      pending = '';
      return trailing;
    },
  };
}
