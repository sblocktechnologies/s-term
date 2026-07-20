export const STERM_OSC_ID = 777;

const VALID_STATES = new Set(['idle', 'working', 'attention', 'complete', 'error']);
const MAX_SIGNAL_LENGTH = 4096;

function cleanText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function parseOptionalNumber(fields, key, minimum, maximum, integer = false) {
  if (!fields.has(key)) return undefined;
  const raw = fields.get(key);
  if (!raw || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    return null;
  }
  return value;
}

function optionalText(fields, key, maxLength) {
  if (!fields.has(key)) return undefined;
  return cleanText(fields.get(key), maxLength);
}

export function parseAgentSignal(data) {
  if (!data.startsWith('sterm;') || data.length > MAX_SIGNAL_LENGTH) return null;

  const fields = new Map();
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

  if (fields.get('v') !== '1') return null;
  const agent = cleanText(fields.get('agent') || 'agent', 32) || 'agent';

  if (fields.get('event') === 'telemetry') {
    const dirtyRaw = fields.get('dirty');
    const subscriptionRaw = fields.get('sub');
    if (dirtyRaw !== undefined && dirtyRaw !== '0' && dirtyRaw !== '1') return null;
    if (subscriptionRaw !== undefined && subscriptionRaw !== '0' && subscriptionRaw !== '1') return null;

    const numericFields = {
      inputTokens: parseOptionalNumber(fields, 'input', 0, 1_000_000_000_000, true),
      outputTokens: parseOptionalNumber(fields, 'output', 0, 1_000_000_000_000, true),
      cacheReadTokens: parseOptionalNumber(fields, 'cacheRead', 0, 1_000_000_000_000, true),
      cacheWriteTokens: parseOptionalNumber(fields, 'cacheWrite', 0, 1_000_000_000_000, true),
      cost: parseOptionalNumber(fields, 'cost', 0, 1_000_000_000),
      contextTokens: parseOptionalNumber(fields, 'contextTokens', 0, 1_000_000_000_000, true),
      contextWindow: parseOptionalNumber(fields, 'contextWindow', 1, 1_000_000_000_000, true),
      contextPercent: parseOptionalNumber(fields, 'contextPercent', 0, 100),
    };
    if (Object.values(numericFields).some((value) => value === null)) return null;

    const telemetry = {
      version: 1,
      event: 'telemetry',
      agent,
      cwd: optionalText(fields, 'cwd', 1024),
      gitBranch: optionalText(fields, 'branch', 200),
      gitDirty: dirtyRaw === undefined ? undefined : dirtyRaw === '1',
      provider: optionalText(fields, 'provider', 100),
      model: optionalText(fields, 'model', 240),
      thinking: optionalText(fields, 'thinking', 32),
      subscription: subscriptionRaw === undefined ? undefined : subscriptionRaw === '1',
      ...numericFields,
    };
    return Object.fromEntries(Object.entries(telemetry).filter(([, value]) => value !== undefined));
  }

  const state = fields.get('state');
  if (!state || !VALID_STATES.has(state)) return null;
  const message = cleanText(fields.get('message') || '', 160);
  return {
    version: 1,
    event: 'status',
    state,
    agent,
    ...(message ? { message } : {}),
  };
}

export function agentDisplayName(agent) {
  if (!agent) return 'Agent';
  const names = {
    pi: 'Pi',
    claude: 'Claude Code',
    codex: 'Codex',
    generic: 'Agent',
  };
  return names[agent.toLowerCase()] || cleanText(agent, 32);
}
