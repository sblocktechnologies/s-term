export const STERM_OSC_ID = 777;

export type AgentState = 'idle' | 'working' | 'attention' | 'complete' | 'error';

export interface AgentSignal {
  version: 1;
  state: AgentState;
  agent: string;
  message?: string;
}

const VALID_STATES = new Set<AgentState>(['idle', 'working', 'attention', 'complete', 'error']);

function cleanText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

export function parseAgentSignal(data: string): AgentSignal | null {
  if (!data.startsWith('sterm;') || data.length > 2048) return null;

  const fields = new Map<string, string>();
  for (const part of data.slice(6).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator);
    try {
      fields.set(key, decodeURIComponent(part.slice(separator + 1)));
    } catch {
      return null;
    }
  }

  const state = fields.get('state') as AgentState | undefined;
  if (fields.get('v') !== '1' || !state || !VALID_STATES.has(state)) return null;

  const agent = cleanText(fields.get('agent') || 'agent', 32);
  const message = cleanText(fields.get('message') || '', 160);
  return {
    version: 1,
    state,
    agent: agent || 'agent',
    ...(message ? { message } : {}),
  };
}

export function agentDisplayName(agent?: string) {
  if (!agent) return 'Agent';
  const names: Record<string, string> = {
    pi: 'Pi',
    claude: 'Claude Code',
    codex: 'Codex',
    generic: 'Agent',
  };
  return names[agent.toLowerCase()] || cleanText(agent, 32);
}
