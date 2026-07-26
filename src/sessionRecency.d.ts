export interface RecencySession {
  createdAt: number;
  lastMessageAt?: number;
}

export interface SessionRecency {
  elapsed: string;
  title: string;
}

export function compactElapsedSince(timestamp: number, now?: number): string;
export function sessionRecency(session: RecencySession, now?: number): SessionRecency;
