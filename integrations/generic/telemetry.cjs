const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const MAX_INPUT_BYTES = 1024 * 1024;
const MARKER = 'sterm-agent-status-v1';
const supportsHeader = process.env.TERM_PROGRAM === 'S-Term' &&
  Boolean(process.env.STERM_SESSION_ID) && process.env.STERM_TELEMETRY_HEADER === '1';

function readInput() {
  try {
    const value = fs.readFileSync(0, 'utf8');
    return value.length <= MAX_INPUT_BYTES ? value : '';
  } catch {
    return '';
  }
}

function parseInput(raw) {
  if (!raw.trim()) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeTerminal(value) {
  if (process.env.STERM_TELEMETRY_TEST_STDERR === '1') {
    process.stderr.write(value);
    return;
  }
  try {
    const target = process.platform === 'win32' ? 'CONOUT$' : '/dev/tty';
    const descriptor = fs.openSync(target, 'w');
    fs.writeSync(descriptor, value);
    fs.closeSync(descriptor);
    return;
  } catch {
    try {
      process.stderr.write(value);
    } catch {
      // Terminal signaling is best effort.
    }
  }
}

function emit(fields) {
  const encoded = ['sterm', 'v=1'];
  for (const [key, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    const stringValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    encoded.push(`${key}=${encodeURIComponent(stringValue)}`);
  }
  writeTerminal(`\x1b]777;${encoded.join(';')}\x07`);
}

function cleanAgent(value) {
  const agent = String(value || 'generic').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32);
  return agent || 'generic';
}

function signal(state, agent) {
  if (!['idle', 'working', 'attention', 'complete', 'error'].includes(state)) return;
  emit([['state', state], ['agent', cleanAgent(agent)]]);
}

function displayCwd(cwd) {
  if (!cwd) return undefined;
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return cwd;
  const resolvedCwd = path.resolve(cwd);
  const resolvedHome = path.resolve(home);
  if (resolvedCwd === resolvedHome) return '~';
  if (resolvedCwd.startsWith(`${resolvedHome}${path.sep}`)) return `~${resolvedCwd.slice(resolvedHome.length)}`;
  return cwd;
}

function gitCacheFile(payload, cwd) {
  const identity = `${payload.session_id || ''}\0${cwd}`;
  const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
  return path.join(os.tmpdir(), `sterm-git-${digest}.json`);
}

function getGit(payload, cwd) {
  if (!cwd) return {};
  const cacheFile = gitCacheFile(payload, cwd);
  try {
    const stat = fs.statSync(cacheFile);
    if (Date.now() - stat.mtimeMs < 4000) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    // Refresh the cache below.
  }

  let branch;
  let dirty;
  try {
    branch = execFileSync('git', ['--no-optional-locks', 'symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1800,
    }).trim() || undefined;
    const status = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '--untracked-files=normal'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500,
      maxBuffer: 4 * 1024 * 1024,
    });
    dirty = status.trim().length > 0;
  } catch {
    branch = undefined;
    dirty = undefined;
  }
  const result = { branch, dirty };
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(result), { mode: 0o600 });
  } catch {
    // Cache writes are optional.
  }
  return result;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function codexReasoning(cwd, payload) {
  const direct = payload.model_reasoning_effort || payload.reasoning_effort || payload.effort?.level;
  if (typeof direct === 'string') return direct;
  const files = [path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml')];
  if (cwd) {
    const projectFiles = [];
    let directory = path.resolve(cwd);
    while (true) {
      projectFiles.unshift(path.join(directory, '.codex', 'config.toml'));
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    files.push(...projectFiles);
  }
  let reasoning;
  for (const file of files) {
    try {
      const match = fs.readFileSync(file, 'utf8').match(/^model_reasoning_effort\s*=\s*["']([^"']+)["']/m);
      if (match) reasoning = match[1];
    } catch {
      // Missing and unreadable config layers are ignored.
    }
  }
  return reasoning;
}

function emitTelemetry(payload, agent) {
  if (!supportsHeader) return;
  const cwd = payload.workspace?.current_dir || payload.cwd || process.cwd();
  const git = getGit(payload, cwd);
  const context = payload.context_window || {};
  const rawModel = payload.model;
  const model = typeof rawModel === 'string'
    ? rawModel
    : rawModel?.display_name || rawModel?.id;
  const thinking = agent === 'codex'
    ? codexReasoning(cwd, payload)
    : payload.effort?.level || payload.thinking;
  const input = finiteNumber(context.total_input_tokens);
  const output = finiteNumber(context.total_output_tokens);
  const contextWindow = finiteNumber(context.context_window_size);
  const contextPercent = finiteNumber(context.used_percentage);
  const contextTokens = input ?? (contextWindow !== undefined && contextPercent !== undefined
    ? Math.round(contextWindow * contextPercent / 100)
    : undefined);
  const cost = finiteNumber(payload.cost?.total_cost_usd);
  const subscription = agent === 'claude' && payload.rate_limits && typeof payload.rate_limits === 'object'
    ? true
    : undefined;

  emit([
    ['event', 'telemetry'],
    ['agent', cleanAgent(agent)],
    ['cwd', displayCwd(cwd)],
    ['branch', git.branch],
    ['dirty', git.dirty],
    ['provider', agent === 'claude' ? 'anthropic' : agent === 'codex' ? 'openai' : undefined],
    ['model', model],
    ['thinking', thinking],
    ['input', input],
    ['output', output],
    ['cost', cost],
    ['sub', subscription],
    ['contextTokens', contextTokens],
    ['contextWindow', contextWindow],
    ['contextPercent', contextPercent],
  ]);
}

function runOriginalClaudeStatusLine(raw) {
  const configFile = path.join(__dirname, 'claude-statusline-original.json');
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    const command = config?.original?.command;
    if (config?.hasOriginal !== true || config.original?.type !== 'command' || typeof command !== 'string' || command.includes(MARKER)) {
      return;
    }
    const result = spawnSync(command, {
      shell: true,
      input: raw,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    if (result.stdout) process.stdout.write(result.stdout);
  } catch {
    // The original status line is optional.
  }
}

const [mode, state, requestedAgent] = process.argv.slice(2);
const raw = readInput();
const payload = parseInput(raw);

if (mode === 'claude-statusline') {
  if (supportsHeader) emitTelemetry(payload, 'claude');
  else runOriginalClaudeStatusLine(raw);
} else if (mode === 'hook') {
  const agent = cleanAgent(requestedAgent);
  signal(state, agent);
  emitTelemetry(payload, agent);
}
