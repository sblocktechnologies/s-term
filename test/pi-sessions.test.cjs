const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listPiSessions, validatePiSession } = require('../electron/pi-sessions.cjs');

function makeSession(home, options = {}) {
  const cwd = options.cwd || path.join(home, 'projects', 'demo');
  const directory = path.join(home, '.pi', 'agent', 'sessions', '--projects-demo--');
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync(cwd, { recursive: true });
  const file = path.join(directory, `${options.id || 'session-id'}.jsonl`);
  const entries = [
    { type: 'session', version: 3, id: options.id || 'session-id', timestamp: '2026-07-01T10:00:00.000Z', cwd },
    { type: 'message', id: 'a', parentId: null, timestamp: '2026-07-01T10:01:00.000Z', message: { role: 'user', content: [{ type: 'text', text: options.prompt || 'Build the dashboard' }] } },
    { type: 'message', id: 'b', parentId: 'a', timestamp: '2026-07-01T10:02:00.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Working on it' }] } },
    ...(options.name ? [{ type: 'session_info', id: 'c', parentId: 'b', timestamp: '2026-07-01T10:03:00.000Z', name: options.name }] : []),
  ];
  fs.writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  return { cwd, file };
}

test('lists Pi sessions with safe searchable metadata', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's-term-pi-sessions-'));
  const { file, cwd } = makeSession(home, { name: 'Dashboard work' });
  const sessions = await listPiSessions({ home });
  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0], {
    id: 'session-id',
    path: file,
    cwd,
    project: 'demo',
    name: 'Dashboard work',
    firstPrompt: 'Build the dashboard',
    messageCount: 2,
    createdAt: Date.parse('2026-07-01T10:00:00.000Z'),
    modifiedAt: sessions[0].modifiedAt,
  });
});

test('validates sessions and restores their working directory', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's-term-pi-session-'));
  const { file, cwd } = makeSession(home);
  assert.deepEqual(validatePiSession(file, { home }), { path: fs.realpathSync(file), cwd, id: 'session-id' });
});

test('rejects files outside Pi session storage', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 's-term-pi-session-'));
  makeSession(home);
  const outside = path.join(home, 'outside.jsonl');
  fs.writeFileSync(outside, '{}\n');
  assert.throws(() => validatePiSession(outside, { home }), /outside/);
});
