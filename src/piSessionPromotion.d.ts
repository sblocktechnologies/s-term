export interface PiSessionLaunchIdentity {
  type: 'pi-session';
  piSessionId: string;
  piSessionPath: string;
  cwd?: string;
  modifiedAt?: number;
}

export interface PiPromotionSession {
  id: string;
  agentName?: string;
  cwd?: string;
  lastMessageAt?: number;
  launch?: PiSessionLaunchIdentity;
  pendingPiLaunch?: PiSessionLaunchIdentity;
}

export interface ValidatedPiSession {
  id: string;
  path: string;
  cwd: string;
  modifiedAt: number;
}

export function validatedPiIdentity(validated: ValidatedPiSession): PiSessionLaunchIdentity;
export function stageValidatedPiSession<T extends PiPromotionSession>(sessions: T[], targetId: string, validated: ValidatedPiSession): T[];
export function promotePendingPiSessions<T extends PiPromotionSession>(sessions: T[]): T[];
export function piSessionNeedsRestartWarning(session: PiPromotionSession): boolean;
