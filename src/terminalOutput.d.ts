export const PI_FULL_REDRAW_CLEAR: string;

export interface TerminalOutputFilter {
  push(data: string, preservePiScrollback: boolean): string;
  flush(): string;
}

export function createTerminalOutputFilter(): TerminalOutputFilter;
