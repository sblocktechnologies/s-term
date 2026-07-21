export function newTerminalGridSlot(
  gridSlots: Array<string | null>,
  sourceId: string,
  selectedSlot?: number,
): number;

export function swapGridSlots(
  gridSlots: Array<string | null>,
  sourceId: string,
  targetSlot: number,
): Array<string | null>;
