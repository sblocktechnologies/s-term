export type GridActivityState = 'working' | 'attention' | 'complete' | 'error';

export interface GridSummarySession {
  id: string;
  agentStatus: string;
}

export const GRID_ACTIVITY_STATES: readonly GridActivityState[];

export function gridWorkspaceSummary(
  gridSlots: Array<string | null>,
  sessions: GridSummarySession[],
): {
  paneCount: number;
  counts: Record<GridActivityState, number>;
};

export function nextGridSessionWithStatus(
  gridSlots: Array<string | null>,
  sessions: GridSummarySession[],
  status: GridActivityState,
  activeId: string,
): string | null;
