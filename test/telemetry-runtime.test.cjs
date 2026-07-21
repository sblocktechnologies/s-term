const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const telemetryScript = path.join(__dirname, '..', 'integrations', 'generic', 'telemetry.cjs');

function runTelemetry(args, payload, options = {}) {
  return spawnSync(process.execPath, [telemetryScript, ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: options.cwd,
    env: {
      ...process.env,
      TERM_PROGRAM: 'S-Term',
      STERM_SESSION_ID: 'test-terminal',
      STERM_TELEMETRY_HEADER: '1',
      STERM_TELEMETRY_TEST_STDERR: '1',
      ...options.env,
    },
  });
}

function oscMessages(output) {
  return [...output.matchAll(/\x1b\]777;([^\x07]*)\x07/g)].map((match) => match[1]);
}

test('Claude status line emits rich S-Term telemetry without visible output', async (t) => {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'sterm-claude-telemetry-'));
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repository });
  fs.writeFileSync(path.join(repository, 'dirty.txt'), 'dirty\n');

  const result = runTelemetry(['claude-statusline'], {
    session_id: 'claude-session',
    workspace: { current_dir: repository },
    model: { id: 'claude-opus-4-6', display_name: 'Opus 4.6' },
    effort: { level: 'high' },
    cost: { total_cost_usd: 0.125 },
    context_window: {
      total_input_tokens: 42000,
      total_output_tokens: 3000,
      context_window_size: 200000,
      used_percentage: 21,
    },
    rate_limits: { five_hour: { used_percentage: 10 } },
  }, { cwd: repository });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  const messages = oscMessages(result.stderr);
  assert.equal(messages.length, 1);
  const { parseAgentSignal } = await import('../src/agentProtocol.js');
  const message = parseAgentSignal(messages[0]);
  assert.equal(message.event, 'telemetry');
  assert.equal(message.agent, 'claude');
  assert.equal(message.gitBranch, 'main');
  assert.equal(message.gitDirty, true);
  assert.equal(message.model, 'Opus 4.6');
  assert.equal(message.thinking, 'high');
  assert.equal(message.subscription, true);
  assert.equal(message.contextPercent, 21);
});

test('Claude lifecycle hooks do not overwrite rich status-line telemetry', async () => {
  const result = runTelemetry(['hook', 'complete', 'claude'], {
    session_id: 'claude-session',
    cwd: '/tmp',
  }, { cwd: '/tmp' });

  assert.equal(result.status, 0);
  const messages = oscMessages(result.stderr);
  assert.equal(messages.length, 1);
  const { parseAgentSignal } = await import('../src/agentProtocol.js');
  const message = parseAgentSignal(messages[0]);
  assert.equal(message.event, 'status');
  assert.equal(message.agent, 'claude');
  assert.equal(message.state, 'complete');
});

test('Codex hooks emit lifecycle status and available header metadata', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sterm-codex-telemetry-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), 'model_reasoning_effort = "xhigh"\n');

  const result = runTelemetry(['hook', 'working', 'codex'], {
    session_id: 'codex-session',
    cwd: home,
    model: 'gpt-5.4',
  }, { cwd: home, env: { HOME: home, CODEX_HOME: path.join(home, '.codex') } });

  assert.equal(result.status, 0);
  const messages = oscMessages(result.stderr);
  assert.equal(messages.length, 2);
  const { parseAgentSignal } = await import('../src/agentProtocol.js');
  const parsed = messages.map(parseAgentSignal);
  assert.equal(parsed[0].event, 'status');
  assert.equal(parsed[0].state, 'working');
  assert.equal(parsed[1].event, 'telemetry');
  assert.equal(parsed[1].agent, 'codex');
  assert.equal(parsed[1].model, 'gpt-5.4');
  assert.equal(parsed[1].thinking, 'xhigh');
});
