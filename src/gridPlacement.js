export function newTerminalGridSlot(gridSlots, sourceId, selectedSlot = 0) {
  const emptySlot = gridSlots.findIndex((terminalId) => !terminalId);
  if (emptySlot >= 0) return emptySlot;
  const sourceSlot = gridSlots.indexOf(sourceId);
  if (sourceSlot >= 0) return sourceSlot;
  return Math.max(0, Math.min(3, selectedSlot));
}

export function swapGridSlots(gridSlots, sourceId, targetSlot) {
  const next = Array.from({ length: 4 }, (_, index) => gridSlots[index] || null);
  const sourceSlot = next.indexOf(sourceId);
  if (sourceSlot < 0 || targetSlot < 0 || targetSlot > 3 || sourceSlot === targetSlot) return next;
  [next[sourceSlot], next[targetSlot]] = [next[targetSlot], next[sourceSlot]];
  return next;
}
