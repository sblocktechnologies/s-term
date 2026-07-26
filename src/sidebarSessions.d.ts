export interface SidebarSession {
  id: string;
  pinned?: boolean;
}

export type SidebarDropPosition = 'before' | 'after';

export function normalizePinnedSessions<T extends SidebarSession>(sessions: T[]): T[];
export function toggleSessionPin<T extends SidebarSession>(sessions: T[], sessionId: string): T[];
export function reorderSidebarSessions<T extends SidebarSession>(
  sessions: T[],
  sourceId: string,
  targetId: string,
  position?: SidebarDropPosition,
): T[];
