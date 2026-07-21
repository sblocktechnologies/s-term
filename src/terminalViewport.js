/**
 * Return the highest viewport line that keeps the last rendered content row at
 * the bottom of the terminal. Blank rows after an inline TUI are excluded.
 */
export function contentAlignedViewport(buffer, rows) {
  if (!buffer || !Number.isInteger(rows) || rows < 1) return null;
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const line = buffer.getLine(index);
    if (!line) continue;
    const text = line.translateToString(true);
    if (text.trim().length === 0) continue;
    // If the active terminal area is blank, this is stale scrollback exposed
    // during a TUI redraw. It must never be used as a clamp destination.
    if (index < buffer.baseY) return null;
    return Math.min(buffer.baseY, Math.max(0, index - rows + 1));
  }
  return null;
}
