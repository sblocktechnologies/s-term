const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const VERSION = 2;
const MARKER = 'sterm-agent-status-v1';
const SUPPORTED_INTEGRATIONS = ['pi', 'claude-code', 'codex'];

const DEFINITIONS = {
  pi: {
    name: 'Pi',
    command: 'pi',
    description: 'Reports working and completed turns through a Pi extension.',
  },
  'claude-code': {
    name: 'Claude Code',
    command: 'claude',
    description: 'Reports prompts, permission requests, completions, and failures.',
  },
  codex: {
    name: 'Codex',
    command: 'codex',
    description: 'Reports prompts, permission requests, and completed turns.',
    note: 'After installing, open /hooks in Codex and trust the S-Term handlers.',
  },
};

const CLAUDE_EVENTS = [
  ['UserPromptSubmit', 'working'],
  ['PermissionRequest', 'attention'],
  ['PostToolUse', 'working'],
  ['Stop', 'complete'],
  ['SessionEnd', 'idle'],
];

const CODEX_EVENTS = [
  ['SessionStart', 'idle'],
  ['UserPromptSubmit', 'working'],
  ['PermissionRequest', 'attention'],
  ['PostToolUse', 'working'],
  ['Stop', 'complete'],
];

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
}

function sha256(file) {
  if (!fs.existsSync(file)) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${file}: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
}

function writeJson(file, value) {
  ensureDirectory(path.dirname(file));
  const currentMode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o600;
  const safeMode = currentMode & 0o077 ? 0o600 : currentMode;
  const temporary = `${file}.sterm-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: safeMode });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, safeMode);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function powershellQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function cleanHookConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return { hooks: {} };
  if (!config.hooks || typeof config.hooks !== 'object' || Array.isArray(config.hooks)) config.hooks = {};
  return config;
}

function isStermHandler(handler) {
  return Boolean(
    handler &&
    typeof handler === 'object' &&
    typeof handler.command === 'string' &&
    handler.command.includes(MARKER),
  );
}

function isStermStatusLine(statusLine) {
  return Boolean(
    statusLine &&
    typeof statusLine === 'object' &&
    statusLine.type === 'command' &&
    typeof statusLine.command === 'string' &&
    statusLine.command.includes(MARKER),
  );
}

function removeStermHooks(config) {
  const result = cleanHookConfig(config);
  for (const [eventName, groups] of Object.entries(result.hooks)) {
    if (!Array.isArray(groups)) continue;
    result.hooks[eventName] = groups
      .map((group) => {
        if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) return group;
        return { ...group, hooks: group.hooks.filter((handler) => !isStermHandler(handler)) };
      })
      .filter((group) => !group || typeof group !== 'object' || !Array.isArray(group.hooks) || group.hooks.length > 0);
    if (result.hooks[eventName].length === 0) delete result.hooks[eventName];
  }
  return result;
}

function hookCount(config) {
  if (!config?.hooks || typeof config.hooks !== 'object') return 0;
  let count = 0;
  for (const groups of Object.values(config.hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!Array.isArray(group?.hooks)) continue;
      count += group.hooks.filter(isStermHandler).length;
    }
  }
  return count;
}

function hasExpectedHooks(config, events, agent) {
  return events.every(([eventName, state]) => {
    const groups = config?.hooks?.[eventName];
    if (!Array.isArray(groups)) return false;
    return groups.some((group) => Array.isArray(group?.hooks) && group.hooks.some((handler) => {
      if (!isStermHandler(handler)) return false;
      return handler.command.includes(` ${state} ${agent} #`) ||
        handler.command.includes(`-State ${state} -Agent ${agent} #`);
    }));
  });
}

function commandExists(command, env, home, platform) {
  const searchPaths = [
    ...(env.PATH || '').split(path.delimiter),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
  ].filter(Boolean);
  const candidates = platform === 'win32'
    ? [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`]
    : [command];
  return searchPaths.some((directory) => candidates.some((candidate) => {
    try {
      fs.accessSync(path.join(directory, candidate), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }));
}

function createIntegrationManager(options = {}) {
  const home = options.home || os.homedir();
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const sourceRoot = options.sourceRoot || path.join(__dirname, '..', 'integrations');
  const stermHome = path.join(home, '.sterm');
  const runtimeDir = path.join(stermHome, 'integrations');
  let backupCounter = 0;

  const paths = {
    piSource: path.join(sourceRoot, 'pi', 'sterm-agent-status.ts'),
    piDestination: path.join(home, '.pi', 'agent', 'extensions', 'sterm-agent-status.ts'),
    claudeConfig: path.join(home, '.claude', 'settings.json'),
    codexConfig: path.join(env.CODEX_HOME || path.join(home, '.codex'), 'hooks.json'),
    signalShSource: path.join(sourceRoot, 'generic', 'signal.sh'),
    signalPs1Source: path.join(sourceRoot, 'generic', 'signal.ps1'),
    telemetrySource: path.join(sourceRoot, 'generic', 'telemetry.cjs'),
    signalSh: path.join(runtimeDir, 'signal.sh'),
    signalPs1: path.join(runtimeDir, 'signal.ps1'),
    telemetry: path.join(runtimeDir, 'telemetry.cjs'),
    claudeStatusLineOriginal: path.join(runtimeDir, 'claude-statusline-original.json'),
    manifest: path.join(runtimeDir, 'manifest.json'),
  };

  function backup(file, label) {
    if (!fs.existsSync(file)) return undefined;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(stermHome, 'backups', `${timestamp}-${backupCounter++}`);
    ensureDirectory(backupDir);
    const destination = path.join(backupDir, label);
    fs.copyFileSync(file, destination);
    fs.chmodSync(destination, 0o600);
    return destination;
  }

  function installRuntime() {
    ensureDirectory(runtimeDir);
    fs.copyFileSync(paths.signalShSource, paths.signalSh);
    fs.copyFileSync(paths.signalPs1Source, paths.signalPs1);
    fs.copyFileSync(paths.telemetrySource, paths.telemetry);
    fs.chmodSync(paths.signalSh, 0o700);
    fs.chmodSync(paths.signalPs1, 0o700);
    fs.chmodSync(paths.telemetry, 0o600);
    writeJson(paths.manifest, {
      version: VERSION,
      installedAt: new Date().toISOString(),
      files: {
        'signal.sh': sha256(paths.signalSh),
        'signal.ps1': sha256(paths.signalPs1),
        'telemetry.cjs': sha256(paths.telemetry),
      },
    });
  }

  function hookCommand(state, agent) {
    if (platform === 'win32') {
      return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${powershellQuote(paths.signalPs1)} -State ${state} -Agent ${agent} # ${MARKER}`;
    }
    return `/bin/sh ${shellQuote(paths.signalSh)} ${state} ${agent} # ${MARKER}`;
  }

  function claudeStatusLineCommand() {
    const script = platform === 'win32' ? paths.telemetry.replaceAll('\\', '/') : paths.telemetry;
    const quoted = platform === 'win32' ? powershellQuote(script) : shellQuote(script);
    return `node ${quoted} claude-statusline # ${MARKER}`;
  }

  function installClaudeStatusLine() {
    const original = readJson(paths.claudeConfig, {});
    const config = structuredClone(original);
    const ownedStatusLine = isStermStatusLine(config.statusLine);
    if (!ownedStatusLine || !fs.existsSync(paths.claudeStatusLineOriginal)) {
      writeJson(paths.claudeStatusLineOriginal, {
        version: VERSION,
        hasOriginal: !ownedStatusLine && Object.prototype.hasOwnProperty.call(config, 'statusLine'),
        original: !ownedStatusLine ? config.statusLine ?? null : null,
      });
    }
    config.statusLine = {
      type: 'command',
      command: claudeStatusLineCommand(),
      padding: 0,
      refreshInterval: 5,
    };
    if (JSON.stringify(original) !== JSON.stringify(config)) {
      backup(paths.claudeConfig, 'claude-settings.json');
      writeJson(paths.claudeConfig, config);
    }
  }

  function uninstallClaudeStatusLine() {
    if (!fs.existsSync(paths.claudeConfig)) return;
    const original = readJson(paths.claudeConfig, {});
    const config = structuredClone(original);
    if (isStermStatusLine(config.statusLine)) {
      const saved = readJson(paths.claudeStatusLineOriginal, { hasOriginal: false });
      if (saved.hasOriginal) config.statusLine = saved.original;
      else delete config.statusLine;
    }
    if (JSON.stringify(original) !== JSON.stringify(config)) {
      backup(paths.claudeConfig, 'claude-settings.json');
      writeJson(paths.claudeConfig, config);
    }
    if (fs.existsSync(paths.claudeStatusLineOriginal)) fs.unlinkSync(paths.claudeStatusLineOriginal);
  }

  function installHookConfig(file, events, agent, label) {
    const original = readJson(file, {});
    const config = removeStermHooks(structuredClone(original));
    for (const [eventName, state] of events) {
      if (!Array.isArray(config.hooks[eventName])) config.hooks[eventName] = [];
      config.hooks[eventName].push({
        hooks: [{
          type: 'command',
          command: hookCommand(state, agent),
          timeout: 5,
        }],
      });
    }
    if (JSON.stringify(original) !== JSON.stringify(config)) {
      backup(file, label);
      writeJson(file, config);
    }
  }

  function uninstallHookConfig(file, label) {
    if (!fs.existsSync(file)) return;
    const original = readJson(file, {});
    const config = removeStermHooks(structuredClone(original));
    if (JSON.stringify(original) !== JSON.stringify(config)) {
      backup(file, label);
      writeJson(file, config);
    }
  }

  function statusFor(id) {
    const definition = DEFINITIONS[id];
    const detected = commandExists(definition.command, env, home, platform) || (
      id === 'pi' ? fs.existsSync(path.join(home, '.pi')) :
      id === 'claude-code' ? fs.existsSync(path.join(home, '.claude')) :
      fs.existsSync(env.CODEX_HOME || path.join(home, '.codex'))
    );

    let installed = false;
    let needsRepair = false;
    let detail = '';
    try {
      if (id === 'pi') {
        installed = sha256(paths.piSource) !== '' && sha256(paths.piSource) === sha256(paths.piDestination);
        needsRepair = fs.existsSync(paths.piDestination) && !installed;
      } else {
        const file = id === 'claude-code' ? paths.claudeConfig : paths.codexConfig;
        const expected = id === 'claude-code' ? CLAUDE_EVENTS.length : CODEX_EVENTS.length;
        const count = fs.existsSync(file) ? hookCount(readJson(file, {})) : 0;
        const shellSourceHash = sha256(paths.signalShSource);
        const powershellSourceHash = sha256(paths.signalPs1Source);
        const telemetrySourceHash = sha256(paths.telemetrySource);
        const runtimeHealthy = Boolean(shellSourceHash && powershellSourceHash && telemetrySourceHash) &&
          shellSourceHash === sha256(paths.signalSh) &&
          powershellSourceHash === sha256(paths.signalPs1) &&
          telemetrySourceHash === sha256(paths.telemetry);
        const events = id === 'claude-code' ? CLAUDE_EVENTS : CODEX_EVENTS;
        const agent = id === 'claude-code' ? 'claude' : 'codex';
        const hookConfig = readJson(file, {});
        const statusLineHealthy = id !== 'claude-code' || (
          isStermStatusLine(hookConfig.statusLine) && fs.existsSync(paths.claudeStatusLineOriginal)
        );
        installed = count === expected && hasExpectedHooks(hookConfig, events, agent) && runtimeHealthy && statusLineHealthy;
        needsRepair = (count > 0 || (id === 'claude-code' && isStermStatusLine(hookConfig.statusLine))) && !installed;
      }
    } catch (error) {
      needsRepair = true;
      detail = error instanceof Error ? error.message : 'Configuration could not be read';
    }

    return {
      id,
      ...definition,
      detected,
      status: installed ? 'installed' : needsRepair ? 'needs-repair' : 'not-installed',
      detail,
    };
  }

  function list() {
    return SUPPORTED_INTEGRATIONS.map(statusFor);
  }

  function install(id) {
    if (!SUPPORTED_INTEGRATIONS.includes(id)) throw new Error(`Unsupported integration: ${id}`);
    installRuntime();

    if (id === 'pi') {
      ensureDirectory(path.dirname(paths.piDestination));
      if (fs.existsSync(paths.piDestination) && sha256(paths.piDestination) !== sha256(paths.piSource)) {
        backup(paths.piDestination, 'pi-sterm-agent-status.ts');
      }
      fs.copyFileSync(paths.piSource, paths.piDestination);
      fs.chmodSync(paths.piDestination, 0o600);
    } else if (id === 'claude-code') {
      installHookConfig(paths.claudeConfig, CLAUDE_EVENTS, 'claude', 'claude-settings.json');
      installClaudeStatusLine();
    } else {
      installHookConfig(paths.codexConfig, CODEX_EVENTS, 'codex', 'codex-hooks.json');
    }

    return statusFor(id);
  }

  function uninstall(id) {
    if (!SUPPORTED_INTEGRATIONS.includes(id)) throw new Error(`Unsupported integration: ${id}`);

    if (id === 'pi') {
      if (fs.existsSync(paths.piDestination) && sha256(paths.piDestination) === sha256(paths.piSource)) {
        fs.unlinkSync(paths.piDestination);
      } else if (fs.existsSync(paths.piDestination)) {
        throw new Error('The installed Pi extension was modified. It was left in place.');
      }
    } else if (id === 'claude-code') {
      uninstallHookConfig(paths.claudeConfig, 'claude-settings.json');
      uninstallClaudeStatusLine();
    } else {
      uninstallHookConfig(paths.codexConfig, 'codex-hooks.json');
    }

    return statusFor(id);
  }

  function installAll({ detectedOnly = false } = {}) {
    return list()
      .filter((integration) => !detectedOnly || integration.detected)
      .map((integration) => install(integration.id));
  }

  function uninstallAll() {
    const results = [];
    for (const id of SUPPORTED_INTEGRATIONS) {
      try {
        results.push(uninstall(id));
      } catch (error) {
        results.push({ ...statusFor(id), detail: error instanceof Error ? error.message : 'Uninstall failed' });
      }
    }
    return results;
  }

  function doctor() {
    const integrations = list();
    const issues = [];
    if (!fs.existsSync(paths.signalShSource) || !fs.existsSync(paths.signalPs1Source) || !fs.existsSync(paths.telemetrySource)) {
      issues.push('The repository signal helpers are missing.');
    }
    for (const integration of integrations) {
      if (integration.status === 'needs-repair') issues.push(`${integration.name} needs repair.`);
      if (integration.detail) issues.push(`${integration.name}: ${integration.detail}`);
    }
    return { ok: issues.length === 0, integrations, issues };
  }

  return {
    list,
    install,
    uninstall,
    installAll,
    uninstallAll,
    doctor,
    paths,
  };
}

module.exports = {
  MARKER,
  SUPPORTED_INTEGRATIONS,
  createIntegrationManager,
};
