const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');

function sessionsRoot(home = os.homedir()) {
  return path.join(home, '.pi', 'agent', 'sessions');
}

async function collectSessionFiles(directory, output = []) {
  let entries;
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectSessionFiles(entryPath, output);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      try {
        const stat = await fsp.stat(entryPath);
        output.push({ path: entryPath, modifiedAt: stat.mtimeMs });
      } catch {
        // A session can disappear while Pi's picker deletes it.
      }
    }
  }));
  return output;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ');
}

function cleanPreview(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function readSessionSummary(file) {
  const input = fs.createReadStream(file.path, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let header;
  let name = '';
  let firstPrompt = '';
  let messageCount = 0;

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      if (!header && entry.type === 'session') {
        header = entry;
      } else if (entry.type === 'session_info') {
        name = cleanPreview(entry.name, 100);
      } else if (entry.type === 'message') {
        messageCount += 1;
        if (!firstPrompt && entry.message?.role === 'user') {
          firstPrompt = cleanPreview(textFromContent(entry.message.content), 180);
        }
      }
    }
  } finally {
    lines.close();
    input.destroy();
  }

  if (!header || typeof header.id !== 'string' || typeof header.cwd !== 'string') return null;
  const cwd = cleanPreview(header.cwd, 2048);
  if (!cwd) return null;

  return {
    id: header.id.slice(0, 80),
    path: file.path,
    cwd,
    project: path.basename(cwd) || cwd,
    name,
    firstPrompt,
    messageCount,
    createdAt: Number.isFinite(Date.parse(header.timestamp)) ? Date.parse(header.timestamp) : file.modifiedAt,
    modifiedAt: file.modifiedAt,
  };
}

async function mapWithLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]).catch(() => null);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function listPiSessions(options = {}) {
  const home = options.home || os.homedir();
  const limit = Math.max(1, Math.min(Number(options.limit) || 200, 2000));
  const files = await collectSessionFiles(sessionsRoot(home));
  files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  const summaries = await mapWithLimit(files.slice(0, limit), 8, readSessionSummary);
  return summaries.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function readHeader(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    const firstLine = buffer.subarray(0, bytesRead).toString('utf8').split(/\r?\n/, 1)[0];
    const header = JSON.parse(firstLine);
    if (header.type !== 'session' || typeof header.id !== 'string' || typeof header.cwd !== 'string') {
      throw new Error('Invalid Pi session header');
    }
    return header;
  } finally {
    fs.closeSync(descriptor);
  }
}

function validatePiSession(sessionPath, options = {}) {
  if (typeof sessionPath !== 'string' || sessionPath.length > 4096) throw new Error('Invalid Pi session path');
  const home = options.home || os.homedir();
  const root = fs.realpathSync(sessionsRoot(home));
  const file = fs.realpathSync(sessionPath);
  if (!file.startsWith(`${root}${path.sep}`) || path.extname(file) !== '.jsonl') {
    throw new Error('Pi session is outside the session directory');
  }
  if (!fs.statSync(file).isFile()) throw new Error('Pi session is not a file');

  const header = readHeader(file);
  const cwd = fs.existsSync(header.cwd) && fs.statSync(header.cwd).isDirectory() ? header.cwd : home;
  return { path: file, cwd, id: header.id };
}

module.exports = {
  listPiSessions,
  readSessionSummary,
  sessionsRoot,
  validatePiSession,
};
