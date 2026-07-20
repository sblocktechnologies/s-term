export const STERM_OSC_ID = 777;

export type AgentState = 'idle' | 'working' | 'attention' | 'complete' | 'error';

export interface AgentSignal {
  version: 1;
  event: 'status';
  state: AgentState;
  agent: string;
  message?: string;
}

export interface AgentTelemetry {
  version: 1;
  event: 'telemetry';
  agent: string;
  cwd?: string;
  gitBranch?: string;
  gitDirty?: boolean;
  provider?: string;
  model?: string;
  thinking?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
  subscription?: boolean;
  contextTokens?: number;
  contextWindow?: number;
  contextPercent?: number;
}

export type AgentProtocolMessage = AgentSignal | AgentTelemetry;

export function parseAgentSignal(data: string): AgentProtocolMessage | null;
export function agentDisplayName(agent?: string): string;
