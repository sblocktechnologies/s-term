const { app, BrowserWindow, clipboard, ipcMain, Menu, shell, Notification } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const pty = require('node-pty');
const { saveClipboardImage } = require('./clipboard-images.cjs');
const { createIntegrationManager } = require('./integration-manager.cjs');
const { listPiSessions, validatePiSession } = require('./pi-sessions.cjs');

const terminals = new Map();
let clipboardImageDirectory;
let integrationManager;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

function terminalKey(ownerId, terminalId) {
  return `${ownerId}:${terminalId}`;
}

function isValidTerminalId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
}

function boundedDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(2, Math.min(500, Math.floor(number))) : fallback;
}

function piResumeCommand(sessionPath, shellExecutable) {
  if (process.platform === 'win32') {
    if (path.basename(shellExecutable).toLowerCase() === 'cmd.exe') {
      return `pi --session "${sessionPath.replaceAll('"', '""')}"`;
    }
    return `pi --session '${sessionPath.replaceAll("'", "''")}'`;
  }
  return `pi --session '${sessionPath.replaceAll("'", "'\\''")}'`;
}

function getShell() {
  if (process.platform === 'win32') {
    return {
      executable: process.env.COMSPEC || 'powershell.exe',
      args: process.env.COMSPEC ? [] : ['-NoLogo'],
    };
  }

  return {
    executable: process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'),
    args: ['-l'],
  };
}

function cleanupTerminalImages(entry) {
  for (const file of entry.tempImages || []) {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // Temporary image cleanup is best effort.
    }
  }
  entry.tempImages?.clear();
}

function killTerminal(key) {
  const entry = terminals.get(key);
  if (!entry) return;

  terminals.delete(key);
  cleanupTerminalImages(entry);
  try {
    entry.process.kill();
  } catch {
    // The shell may already have exited.
  }
}

function killOwnerTerminals(ownerId) {
  for (const [key, entry] of terminals) {
    if (entry.ownerId === ownerId) killTerminal(key);
  }
}

function registerIpc() {
  ipcMain.handle('terminal:create', (event, options = {}) => {
    const terminalId = options.id;
    if (!isValidTerminalId(terminalId)) throw new Error('Invalid terminal id');

    const ownerId = event.sender.id;
    const key = terminalKey(ownerId, terminalId);
    const existing = terminals.get(key);
    if (existing) {
      return { pid: existing.process.pid };
    }

    const shellConfig = getShell();
    const piSession = options.piSessionPath
      ? validatePiSession(options.piSessionPath)
      : undefined;
    const requestedCwd = typeof options.cwd === 'string' ? options.cwd : '';
    const cwd = piSession?.cwd || (requestedCwd && fs.existsSync(requestedCwd) ? requestedCwd : os.homedir());
    const child = pty.spawn(shellConfig.executable, shellConfig.args, {
      name: 'xterm-256color',
      cols: boundedDimension(options.cols, 80),
      rows: boundedDimension(options.rows, 24),
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'S-Term',
        TERM_PROGRAM_VERSION: app.getVersion(),
        STERM_SESSION_ID: terminalId,
        STERM_TELEMETRY_HEADER: '1',
        STERM_INTEGRATIONS_DIR: path.join(os.homedir(), '.sterm', 'integrations'),
      },
    });

    terminals.set(key, { process: child, ownerId, terminalId, tempImages: new Set() });

    child.onData((data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal:data', { id: terminalId, data });
      }
    });

    child.onExit(({ exitCode, signal }) => {
      const entry = terminals.get(key);
      if (entry) cleanupTerminalImages(entry);
      terminals.delete(key);
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal:exit', { id: terminalId, exitCode, signal });
      }
    });

    if (piSession) {
      setTimeout(() => {
        if (terminals.has(key)) child.write(`${piResumeCommand(piSession.path, shellConfig.executable)}\r`);
      }, 120);
    }

    return { pid: child.pid };
  });

  ipcMain.on('terminal:write', (event, payload = {}) => {
    if (!isValidTerminalId(payload.id) || typeof payload.data !== 'string') return;
    const entry = terminals.get(terminalKey(event.sender.id, payload.id));
    if (entry) entry.process.write(payload.data);
  });

  ipcMain.on('terminal:resize', (event, payload = {}) => {
    if (!isValidTerminalId(payload.id)) return;
    const entry = terminals.get(terminalKey(event.sender.id, payload.id));
    if (!entry) return;

    try {
      entry.process.resize(
        boundedDimension(payload.cols, 80),
        boundedDimension(payload.rows, 24),
      );
    } catch {
      // Resize can race with a shell exiting.
    }
  });

  ipcMain.handle('terminal:kill', (event, terminalId) => {
    if (!isValidTerminalId(terminalId)) return;
    killTerminal(terminalKey(event.sender.id, terminalId));
  });

  ipcMain.handle('clipboard:save-image', (event, terminalId) => {
    if (!isValidTerminalId(terminalId)) throw new Error('Invalid terminal id');
    const entry = terminals.get(terminalKey(event.sender.id, terminalId));
    if (!entry) throw new Error('Terminal is not running');

    if (!clipboardImageDirectory) {
      clipboardImageDirectory = fs.mkdtempSync(path.join(app.getPath('temp'), 's-term-images-'));
    }
    const file = saveClipboardImage(clipboard.readImage(), clipboardImageDirectory);
    if (file) entry.tempImages.add(file);
    return file;
  });

  ipcMain.handle('terminal:context-menu', (event, payload = {}) => {
    if (!isValidTerminalId(payload.id)) return;
    if (!terminals.has(terminalKey(event.sender.id, payload.id))) return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    const menu = Menu.buildFromTemplate([
      {
        label: 'Copy',
        enabled: Boolean(payload.canCopy),
        click: () => event.sender.send('app:command', 'copy'),
      },
      {
        label: 'Paste',
        click: () => event.sender.send('app:command', 'paste'),
      },
      { type: 'separator' },
      {
        label: 'Clear',
        click: () => event.sender.send('app:command', 'clear'),
      },
    ]);
    menu.popup({ window });
  });

  ipcMain.handle('pi:sessions:list', (_event, limit) => listPiSessions({ limit }));

  ipcMain.handle('integrations:list', () => integrationManager.list());
  ipcMain.handle('integrations:install', (_event, id) => integrationManager.install(id));
  ipcMain.handle('integrations:uninstall', (_event, id) => integrationManager.uninstall(id));
  ipcMain.handle('integrations:doctor', () => integrationManager.doctor());

  ipcMain.handle('app:open-external', (_event, url) => {
    if (typeof url !== 'string' || url.length > 4096 || !/^https?:\/\//i.test(url)) return false;
    void shell.openExternal(url);
    return true;
  });

  ipcMain.on('app:notify', (_event, payload = {}) => {
    if (!Notification.isSupported()) return;
    const title = typeof payload.title === 'string' ? payload.title.slice(0, 80) : 'S-Term';
    const body = typeof payload.body === 'string' ? payload.body.slice(0, 180) : '';
    if (!body) return;
    new Notification({ title, body, silent: true }).show();
  });

  ipcMain.handle('app:version', () => app.getVersion());
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#020617',
    title: 'S-Term',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 17 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const ownerId = window.webContents.id;
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const key = input.key.toLowerCase();
    const primary = isMac ? input.meta : input.control;
    let command = '';

    if (primary && input.shift && key === 't') command = 'new-terminal';
    else if (primary && !input.shift && key === '1') command = 'focus-layout';
    else if (primary && !input.shift && key === '4') command = 'grid-layout';
    else if (primary && !input.shift && key === 'w') command = 'close-terminal';
    else if (isMac && input.meta && key === 'c') command = 'copy';
    else if (isMac && input.meta && key === 'v') command = 'paste';
    else if (!isMac && input.control && input.shift && key === 'c') command = 'copy';
    else if (!isMac && input.control && input.shift && key === 'v') command = 'paste';
    else if (primary && key === 'k') command = 'clear';

    if (command) {
      event.preventDefault();
      window.webContents.send('app:command', command);
    }
  });
  window.webContents.on('will-navigate', (event, url) => {
    const allowedUrl = isDevelopment ? process.env.VITE_DEV_SERVER_URL : `file://${path.join(__dirname, '../dist/index.html')}`;
    if (url !== allowedUrl) event.preventDefault();
  });
  window.webContents.once('destroyed', () => killOwnerTerminals(ownerId));

  if (isDevelopment) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  integrationManager = createIntegrationManager({
    sourceRoot: app.isPackaged
      ? path.join(process.resourcesPath, 'integrations')
      : path.join(__dirname, '..', 'integrations'),
  });
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  for (const key of [...terminals.keys()]) killTerminal(key);
  if (clipboardImageDirectory) {
    try {
      fs.rmSync(clipboardImageDirectory, { recursive: true, force: true });
    } catch {
      // Temporary image cleanup is best effort.
    }
    clipboardImageDirectory = undefined;
  }
});
