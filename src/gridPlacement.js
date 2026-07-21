export function newTerminalGridSlot(gridSlots, sourceId, selectedSlot = 0) {
  const emptySlot = gridSlots.findIndex((terminalId) => !terminalId);
  if (emptySlot >= 0) return emptySlot;
  const sourceSlot = gridSlots.indexOf(sourceId);
  if (sourceSlot >= 0) return sourceSlot;
  return Math.max(0, Math.min(3, selectedSlot));
}
