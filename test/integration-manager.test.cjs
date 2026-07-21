const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createIntegrationManager, MARKER } = require('../electron/integration-manager.cjs');

const sourceRoot = path.join(__dirname, '..', 'integrations');

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sterm-integrations-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  for (const command of ['pi', 'claude', 'codex']) {
    const file = path.join(bin, command);
    fs.writeFileSync(file, '#!/bin/sh\n');
    fs.chmodSync(file, 0o700);
  }
  const manager = createIntegrationManager({
    home,
    sourceRoot,
    env: { PATH: bin, CODEX_HOME: path.join(home, '.codex') },
    platform: 'darwin',
  });
  return { home, manager };
}

test('installs all integrations without replacing existing hooks', () => {
  const { home, manager } = fixture();
  const claudeFile = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(claudeFile), { recursive: true });
  fs.writeFileSync(claudeFile, JSON.stringify({
    model: 'test-model',
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }],
    },
  }));

  const results = manager.installAll({ detectedOnly: true });
  assert.equal(results.length, 3);
  assert.ok(results.every((item) => item.status === 'installed'));

  const claude = JSON.parse(fs.readFileSync(claudeFile, 'utf8'));
  assert.equal(claude.model, 'test-model');
  assert.ok(JSON.stringify(claude).includes('echo existing'));
  assert.ok(JSON.stringify(claude).includes(MARKER));
  assert.ok(claude.statusLine.command.includes('telemetry.cjs'));
  assert.ok(fs.existsSync(manager.paths.telemetry));
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(home, '.sterm')).mode & 0o777, 0o700);
    assert.equal(fs.statSync(manager.paths.signalSh).mode & 0o777, 0o700);
  }
});

test('installation is idempotent', () => {
  const { manager } = fixture();
  manager.install('claude-code');
  const first = fs.readFileSync(manager.paths.claudeConfig, 'utf8');
  manager.install('claude-code');
  const second = fs.readFileSync(manager.paths.claudeConfig, 'utf8');
  assert.equal(first, second);
});

test('uninstall removes only S-Term-owned handlers', () => {
  const { manager } = fixture();
  manager.install('codex');
  const config = JSON.parse(fs.readFileSync(manager.paths.codexConfig, 'utf8'));
  config.hooks.Stop.push({ hooks: [{ type: 'command', command: 'echo keep-me' }] });
  fs.writeFileSync(manager.paths.codexConfig, JSON.stringify(config));

  const status = manager.uninstall('codex');
  assert.equal(status.status, 'not-installed');
  const after = fs.readFileSync(manager.paths.codexConfig, 'utf8');
  assert.ok(after.includes('echo keep-me'));
  assert.ok(!after.includes(MARKER));
});

test('Claude status line is restored exactly on uninstall', () => {
  const { home, manager } = fixture();
  const claudeFile = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(claudeFile), { recursive: true });
  const originalStatusLine = {
    type: 'command',
    command: 'node ~/.claude/my-status.cjs',
    refreshInterval: 12,
  };
  fs.writeFileSync(claudeFile, JSON.stringify({ statusLine: originalStatusLine }));

  manager.install('claude-code');
  const installed = JSON.parse(fs.readFileSync(claudeFile, 'utf8'));
  assert.ok(installed.statusLine.command.includes(MARKER));

  manager.uninstall('claude-code');
  const uninstalled = JSON.parse(fs.readFileSync(claudeFile, 'utf8'));
  assert.deepEqual(uninstalled.statusLine, originalStatusLine);
  assert.deepEqual(uninstalled.hooks, {});
});

test('modified Pi extensions are preserved on uninstall', () => {
  const { manager } = fixture();
  manager.install('pi');
  fs.appendFileSync(manager.paths.piDestination, '\n// local change\n');
  assert.throws(() => manager.uninstall('pi'), /modified/);
  assert.ok(fs.existsSync(manager.paths.piDestination));
});

test('invalid existing configuration is never overwritten', () => {
  const { manager } = fixture();
  fs.mkdirSync(path.dirname(manager.paths.claudeConfig), { recursive: true });
  fs.writeFileSync(manager.paths.claudeConfig, '{ invalid json');
  assert.throws(() => manager.install('claude-code'), /Cannot parse/);
  assert.equal(fs.readFileSync(manager.paths.claudeConfig, 'utf8'), '{ invalid json');
});

test('generates a self-contained PowerShell hook on Windows', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sterm-integrations-win-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'claude.cmd'), '@echo off\r\n');
  fs.chmodSync(path.join(bin, 'claude.cmd'), 0o700);
  const manager = createIntegrationManager({ home, sourceRoot, env: { PATH: bin }, platform: 'win32' });
  const status = manager.install('claude-code');
  assert.equal(status.status, 'installed');
  const config = fs.readFileSync(manager.paths.claudeConfig, 'utf8');
  assert.match(config, /powershell\.exe -NoProfile/);
  assert.match(config, /signal\.ps1/);
  assert.match(config, /telemetry\.cjs/);
});
