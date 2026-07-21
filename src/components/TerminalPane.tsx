import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CloseIcon, GridIcon, GridPositionIcon, PlusIcon, TerminalIcon } from '../icons';
import { parseAgentSignal, STERM_OSC_ID, type AgentProtocolMessage, type AgentState, type AgentTelemetry } from '../agentProtocol.js';
import { getPiEditorSequence, PI_IMAGE_PASTE_SEQUENCE } from '../terminal-keymap.js';
import { contentAlignedViewport } from '../terminalViewport.js';

interface TerminalPaneProps {
  id: string;
  name: string;
  title: string;
  status: 'running' | 'exited';
  piSessionPath?: string;
  initialCwd?: string;
  piMode: boolean;
  agentStatus: AgentState;
  agentName?: string;
  telemetry?: AgentTelemetry;
  active: boolean;
  visible: boolean;
  order: number;
  gridSlot?: number;
  onActivate: () => void;
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: 'running' | 'exited') => void;
  onCwdChange: (cwd: string) => void;
  onNewTerminalHere: () => void;
  onAgentSignal: (signal: AgentProtocolMessage) => void;
  onFocusMode: () => void;
  onRemoveFromGrid?: () => void;
  onGridPaneDrop?: (terminalId: string) => void;
  onTerminalDrop?: (terminalId: string) => void;
}

const GRID_POSITION_LABELS = ['Top left', 'Top right', 'Bottom left', 'Bottom right'] as const;

function cleanTitle(title: string) {
  return title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 90);
}

function displayCwd(cwd: string) {
  const unixHome = cwd.match(/^\/(?:Users|home)\/[^/]+/)?.[0];
  if (unixHome) return `~${cwd.slice(unixHome.length)}`;
  const windowsHome = cwd.match(/^[A-Za-z]:\\Users\\[^\\]+/i)?.[0];
  return windowsHome ? `~${cwd.slice(windowsHome.length)}` : cwd;
}

function formatTokens(count: number | undefined) {
  if (count === undefined) return '';
  if (count < 1_000) return String(count);
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

function shellQuotedPath(file: string) {
  if (window.sterm.platform === 'win32') return `"${file.replaceAll('"', '""')}"`;
  return `'${file.replaceAll("'", "'\\''")}'`;
}

function telemetryTitle(telemetry: AgentTelemetry) {
  const details = [telemetry.cwd];
  if (telemetry.gitBranch) details.push(`${telemetry.gitBranch}${telemetry.gitDirty ? ' (dirty)' : ''}`);
  details.push(`Input ${formatTokens(telemetry.inputTokens) || '0'}`);
  details.push(`Output ${formatTokens(telemetry.outputTokens) || '0'}`);
  if (telemetry.cacheReadTokens) details.push(`Cache read ${formatTokens(telemetry.cacheReadTokens)}`);
  if (telemetry.cacheWriteTokens) details.push(`Cache write ${formatTokens(telemetry.cacheWriteTokens)}`);
  if (telemetry.subscription) details.push('Subscription');
  else if (telemetry.cost !== undefined) details.push(`$${telemetry.cost.toFixed(3)}`);
  if (telemetry.contextWindow) {
    details.push(`Context ${telemetry.contextPercent === undefined ? '?' : `${telemetry.contextPercent.toFixed(1)}%`}/${formatTokens(telemetry.contextWindow)}`);
  }
  if (telemetry.provider || telemetry.model) details.push([telemetry.provider, telemetry.model].filter(Boolean).join('/'));
  if (telemetry.thinking) details.push(`Reasoning ${telemetry.thinking}`);
  return details.filter(Boolean).join(' · ');
}

export default function TerminalPane({
  id,
  name,
  title,
  status,
  piSessionPath,
  initialCwd,
  piMode,
  agentStatus,
  agentName,
  telemetry,
  active,
  visible,
  order,
  gridSlot,
  onActivate,
  onClose,
  onTitleChange,
  onStatusChange,
  onCwdChange,
  onNewTerminalHere,
  onAgentSignal,
  onFocusMode,
  onRemoveFromGrid,
  onGridPaneDrop,
  onTerminalDrop,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const pasteRef = useRef<() => void>(() => undefined);
  const clampViewportRef = useRef<() => void>(() => undefined);
  const piModeRef = useRef(piMode);
  const agentStatusRef = useRef(agentStatus);
  piModeRef.current = piMode;
  agentStatusRef.current = agentStatus;
  const callbacksRef = useRef({ onTitleChange, onStatusChange, onCwdChange, onAgentSignal });
  callbacksRef.current = { onTitleChange, onStatusChange, onCwdChange, onAgentSignal };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let fitFrame = 0;
    let clampFrame = 0;
    const terminal = new Terminal({
      allowProposedApi: false,
      altClickMovesCursor: true,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 1,
      drawBoldTextInBrightColors: true,
      fontFamily: '"SFMono-Regular", "Cascadia Code", "Roboto Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      fontWeight: '400',
      fontWeightBold: '600',
      letterSpacing: 0,
      lineHeight: 1.32,
      macOptionIsMeta: true,
      minimumContrastRatio: 4.5,
      rightClickSelectsWord: true,
      scrollback: 10000,
      smoothScrollDuration: 80,
      linkHandler: {
        activate: (_event, uri) => void window.sterm.openExternal(uri),
        hover: (_event, uri) => { host.title = uri; },
        leave: () => { host.removeAttribute('title'); },
        allowNonHttpProtocols: false,
      },
      theme: {
        background: '#020617',
        foreground: '#e5e7eb',
        cursor: '#3c83f6',
        cursorAccent: '#020617',
        selectionBackground: '#1e3a5f',
        selectionInactiveBackground: '#1e293b',
        black: '#0f172a',
        red: '#f87171',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3c83f6',
        magenta: '#818cf8',
        cyan: '#38bdf8',
        white: '#e5e7eb',
        brightBlack: '#64748b',
        brightRed: '#fca5a5',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a5b4fc',
        brightCyan: '#7dd3fc',
        brightWhite: '#f8fafc',
      },
    });
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon(
      (_event, uri) => void window.sterm.openExternal(uri),
      {
        hover: (_event, uri) => { host.title = uri; },
        leave: () => { host.removeAttribute('title'); },
      },
    );
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    const clampPiViewport = () => {
      cancelAnimationFrame(clampFrame);
      clampFrame = requestAnimationFrame(() => {
        if (disposed || !piModeRef.current || agentStatusRef.current === 'working') return;
        const buffer = terminal.buffer.active;
        const target = contentAlignedViewport(buffer, terminal.rows);
        if (target !== null && buffer.viewportY > target) terminal.scrollToLine(target);
      });
    };
    clampViewportRef.current = clampPiViewport;

    const oscDisposable = terminal.parser.registerOscHandler(STERM_OSC_ID, (data) => {
      const signal = parseAgentSignal(data);
      if (!signal) return false;
      if (signal.event === 'status' && signal.agent === 'pi') {
        agentStatusRef.current = signal.state;
        if (signal.state === 'working') {
          requestAnimationFrame(() => terminal.scrollToBottom());
        } else {
          clampPiViewport();
        }
      }
      callbacksRef.current.onAgentSignal(signal);
      return true;
    });
    terminal.open(host);
    terminalRef.current = terminal;

    const fit = () => {
      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        if (disposed || host.clientWidth < 20 || host.clientHeight < 20) return;
        try {
          fitAddon.fit();
        } catch {
          // A layout transition may briefly report an unusable size.
        }
      });
    };

    const stopData = window.sterm.terminal.onData(id, (data) => terminal.write(data, clampPiViewport));
    const stopExit = window.sterm.terminal.onExit(id, ({ exitCode }) => {
      terminal.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}.\x1b[0m`);
      callbacksRef.current.onStatusChange('exited');
    });
    const pasteClipboard = async () => {
      try {
        if (window.sterm.clipboard.hasImage()) {
          if (piModeRef.current) {
            window.sterm.terminal.write(id, PI_IMAGE_PASTE_SEQUENCE);
            return;
          }
          const imagePath = await window.sterm.clipboard.saveImage(id);
          if (!disposed && imagePath) terminal.paste(shellQuotedPath(imagePath));
          return;
        }
        const text = window.sterm.clipboard.readText();
        if (text) terminal.paste(text);
      } catch {
        // Clipboard access can be denied by the operating system.
      }
    };
    pasteRef.current = () => void pasteClipboard();

    const inputDisposable = terminal.onData((data) => window.sterm.terminal.write(id, data));
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.sterm.terminal.resize(id, cols, rows);
      clampPiViewport();
    });
    const scrollDisposable = terminal.onScroll(clampPiViewport);
    const titleDisposable = terminal.onTitleChange((nextTitle) => {
      const cleaned = cleanTitle(nextTitle);
      if (cleaned) callbacksRef.current.onTitleChange(cleaned);
    });

    terminal.attachCustomKeyEventHandler((event) => {
      const piEditorSequence = piModeRef.current
        ? getPiEditorSequence(event, window.sterm.platform)
        : null;
      if (piEditorSequence) {
        event.preventDefault();
        if (event.type === 'keydown') window.sterm.terminal.write(id, piEditorSequence);
        return false;
      }

      if (event.type !== 'keydown') return true;

      const key = event.key.toLowerCase();
      const isMac = window.sterm.platform === 'darwin';
      const copyShortcut = (isMac && event.metaKey && key === 'c') ||
        (!isMac && event.ctrlKey && event.shiftKey && key === 'c');
      const pasteShortcut = (isMac && event.metaKey && key === 'v') ||
        (!isMac && event.ctrlKey && event.shiftKey && key === 'v');
      const clearShortcut = (isMac ? event.metaKey : event.ctrlKey) && key === 'k';

      if (copyShortcut) {
        if (terminal.hasSelection()) window.sterm.clipboard.writeText(terminal.getSelection());
        return false;
      }
      if (pasteShortcut) {
        void pasteClipboard();
        return false;
      }
      if (clearShortcut) {
        terminal.clear();
        return false;
      }
      return true;
    });

    const showContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void window.sterm.terminal.showContextMenu(id, terminal.hasSelection());
    };
    host.addEventListener('contextmenu', showContextMenu);

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);
    fit();

    requestAnimationFrame(async () => {
      if (disposed) return;
      fitAddon.fit();
      try {
        const created = await window.sterm.terminal.create({
          id,
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: initialCwd,
          piSessionPath,
        });
        callbacksRef.current.onCwdChange(created.cwd);
        callbacksRef.current.onStatusChange('running');
        window.sterm.terminal.resize(id, terminal.cols, terminal.rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start the shell';
        terminal.writeln(`\x1b[31m${message}\x1b[0m`);
        callbacksRef.current.onStatusChange('exited');
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(fitFrame);
      cancelAnimationFrame(clampFrame);
      resizeObserver.disconnect();
      host.removeEventListener('contextmenu', showContextMenu);
      pasteRef.current = () => undefined;
      clampViewportRef.current = () => undefined;
      stopData();
      stopExit();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      scrollDisposable.dispose();
      titleDisposable.dispose();
      oscDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [id, piSessionPath]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      if (active) terminalRef.current?.focus();
      clampViewportRef.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [active, visible]);

  useEffect(() => {
    if (piMode && agentStatus !== 'working') clampViewportRef.current();
  }, [agentStatus, piMode]);

  useEffect(() => {
    if (!active) return;

    const onCommand = (event: Event) => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      const command = (event as CustomEvent<AppCommand>).detail;

      if (command === 'copy' && terminal.hasSelection()) {
        window.sterm.clipboard.writeText(terminal.getSelection());
      } else if (command === 'paste') {
        pasteRef.current();
      } else if (command === 'clear') {
        terminal.clear();
      }
    };

    window.addEventListener('sterm:terminal-command', onCommand);
    return () => window.removeEventListener('sterm:terminal-command', onCommand);
  }, [active, id]);

  return (
    <section
      className={`terminal-pane${active ? ' active' : ''}${visible ? '' : ' hidden'}`}
      style={{ order }}
      onMouseDown={onActivate}
      onDragOver={(event) => {
        if (onGridPaneDrop || onTerminalDrop) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onGridPaneDrop && !onTerminalDrop) return;
        event.preventDefault();
        const paneId = event.dataTransfer.getData('application/x-sterm-grid-pane');
        if (paneId && onGridPaneDrop) {
          onGridPaneDrop(paneId);
          return;
        }
        const terminalId = event.dataTransfer.getData('application/x-sterm-terminal');
        if (terminalId) onTerminalDrop?.(terminalId);
      }}
      aria-label={name}
    >
      <header
        className="pane-header"
        draggable={Boolean(onGridPaneDrop)}
        title={onGridPaneDrop ? 'Drag to move this pane' : undefined}
        onDoubleClick={onFocusMode}
        onDragStart={(event) => {
          if (!onGridPaneDrop || (event.target as HTMLElement).closest('button')) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/x-sterm-grid-pane', id);
        }}
      >
        <div className="pane-title-wrap">
          {gridSlot ? (
            <span className="pane-slot-position" title={`${GRID_POSITION_LABELS[gridSlot - 1]} grid position`}>
              <GridPositionIcon position={gridSlot - 1} />
            </span>
          ) : <TerminalIcon className="pane-terminal-icon" />}
          <span className={`status-dot ${agentStatus !== 'idle' ? `agent-${agentStatus}` : status}`} />
          <span className="pane-title" title={title}>{title || name}</span>
          {agentStatus !== 'idle' && (
            <span className={`pane-agent-state ${agentStatus}`}>
              {agentName || 'Agent'} {agentStatus === 'complete' ? 'done' : agentStatus}
            </span>
          )}
        </div>
        {telemetry && (
          <div className="pane-telemetry" title={telemetryTitle(telemetry)}>
            {telemetry.cwd && <span className="pane-cwd">{displayCwd(telemetry.cwd)}</span>}
            {telemetry.gitBranch && (
              <span className={`pane-git${telemetry.gitDirty ? ' dirty' : ''}`}>
                {telemetry.gitBranch}{telemetry.gitDirty ? '*' : ''}
              </span>
            )}
            {(telemetry.inputTokens !== undefined || telemetry.outputTokens !== undefined) && (
              <span className="pane-usage pane-meta-secondary">
                ↑{formatTokens(telemetry.inputTokens) || '0'} ↓{formatTokens(telemetry.outputTokens) || '0'}
              </span>
            )}
            {(telemetry.cacheReadTokens || telemetry.cacheWriteTokens) ? (
              <span className="pane-cache pane-meta-tertiary">
                {telemetry.cacheReadTokens ? `R${formatTokens(telemetry.cacheReadTokens)}` : ''}
                {telemetry.cacheWriteTokens ? ` W${formatTokens(telemetry.cacheWriteTokens)}` : ''}
              </span>
            ) : null}
            {telemetry.contextWindow && (
              <span className={`pane-context${(telemetry.contextPercent || 0) > 90 ? ' danger' : (telemetry.contextPercent || 0) > 70 ? ' warning' : ''}`}>
                {telemetry.contextPercent === undefined ? '?' : `${telemetry.contextPercent.toFixed(1)}%`}/{formatTokens(telemetry.contextWindow)}
              </span>
            )}
            {telemetry.subscription ? (
              <span className="pane-billing pane-meta-secondary">sub</span>
            ) : telemetry.cost !== undefined ? (
              <span className="pane-billing pane-meta-secondary">${telemetry.cost.toFixed(3)}</span>
            ) : null}
            {telemetry.model && <span className="pane-model">{telemetry.model}</span>}
            {telemetry.thinking && <span className="pane-thinking">{telemetry.thinking}</span>}
          </div>
        )}
        <div className="pane-actions">
          {onRemoveFromGrid && (
            <button
              className="icon-button pane-grid-remove"
              type="button"
              title="Remove from grid"
              aria-label="Remove from grid"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveFromGrid();
              }}
            >
              <GridIcon />
            </button>
          )}
          <button
            className="icon-button pane-new-terminal"
            type="button"
            title="New terminal in this folder"
            aria-label="New terminal in this folder"
            onClick={(event) => {
              event.stopPropagation();
              onNewTerminalHere();
            }}
          >
            <PlusIcon />
          </button>
          <button
            className="icon-button pane-close"
            type="button"
            title={`Close ${name}`}
            aria-label={`Close ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <CloseIcon />
          </button>
        </div>
      </header>
      <div className="terminal-host" ref={hostRef} />
    </section>
  );
}
