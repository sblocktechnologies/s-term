import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { CloseIcon, GridIcon, TerminalIcon } from '../icons';
import { parseAgentSignal, STERM_OSC_ID, type AgentSignal, type AgentState } from '../agentProtocol';
import { getPiEditorSequence } from '../terminal-keymap.js';

interface TerminalPaneProps {
  id: string;
  name: string;
  title: string;
  status: 'running' | 'exited';
  piSessionPath?: string;
  piMode: boolean;
  agentStatus: AgentState;
  agentName?: string;
  active: boolean;
  visible: boolean;
  order: number;
  gridSlot?: number;
  onActivate: () => void;
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onStatusChange: (status: 'running' | 'exited') => void;
  onAgentSignal: (signal: AgentSignal) => void;
  onFocusMode: () => void;
  onRemoveFromGrid?: () => void;
  onTerminalDrop?: (terminalId: string) => void;
}

function cleanTitle(title: string) {
  return title.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 90);
}

export default function TerminalPane({
  id,
  name,
  title,
  status,
  piSessionPath,
  piMode,
  agentStatus,
  agentName,
  active,
  visible,
  order,
  gridSlot,
  onActivate,
  onClose,
  onTitleChange,
  onStatusChange,
  onAgentSignal,
  onFocusMode,
  onRemoveFromGrid,
  onTerminalDrop,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const piModeRef = useRef(piMode);
  piModeRef.current = piMode;
  const callbacksRef = useRef({ onTitleChange, onStatusChange, onAgentSignal });
  callbacksRef.current = { onTitleChange, onStatusChange, onAgentSignal };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let fitFrame = 0;
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
    const oscDisposable = terminal.parser.registerOscHandler(STERM_OSC_ID, (data) => {
      const signal = parseAgentSignal(data);
      if (!signal) return false;
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

    const stopData = window.sterm.terminal.onData(id, (data) => terminal.write(data));
    const stopExit = window.sterm.terminal.onExit(id, ({ exitCode }) => {
      terminal.writeln(`\r\n\x1b[90mProcess exited with code ${exitCode}.\x1b[0m`);
      callbacksRef.current.onStatusChange('exited');
    });
    const inputDisposable = terminal.onData((data) => window.sterm.terminal.write(id, data));
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      window.sterm.terminal.resize(id, cols, rows);
    });
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
        const text = window.sterm.clipboard.readText();
        if (text) window.sterm.terminal.write(id, text);
        return false;
      }
      if (clearShortcut) {
        terminal.clear();
        return false;
      }
      return true;
    });

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);
    fit();

    requestAnimationFrame(async () => {
      if (disposed) return;
      fitAddon.fit();
      try {
        await window.sterm.terminal.create({
          id,
          cols: terminal.cols,
          rows: terminal.rows,
          piSessionPath,
        });
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
      resizeObserver.disconnect();
      stopData();
      stopExit();
      inputDisposable.dispose();
      resizeDisposable.dispose();
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
    });
    return () => cancelAnimationFrame(frame);
  }, [active, visible]);

  useEffect(() => {
    if (!active) return;

    const onCommand = (event: Event) => {
      const terminal = terminalRef.current;
      if (!terminal) return;
      const command = (event as CustomEvent<AppCommand>).detail;

      if (command === 'copy' && terminal.hasSelection()) {
        window.sterm.clipboard.writeText(terminal.getSelection());
      } else if (command === 'paste') {
        const text = window.sterm.clipboard.readText();
        if (text) window.sterm.terminal.write(id, text);
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
        if (onTerminalDrop) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onTerminalDrop) return;
        event.preventDefault();
        const terminalId = event.dataTransfer.getData('application/x-sterm-terminal');
        if (terminalId) onTerminalDrop(terminalId);
      }}
      aria-label={name}
    >
      <header className="pane-header" onDoubleClick={onFocusMode}>
        <div className="pane-title-wrap">
          {gridSlot ? <span className="pane-slot-number">{gridSlot}</span> : <TerminalIcon className="pane-terminal-icon" />}
          <span className={`status-dot ${agentStatus !== 'idle' ? `agent-${agentStatus}` : status}`} />
          <span className="pane-title" title={title}>{title || name}</span>
          {agentStatus !== 'idle' && (
            <span className={`pane-agent-state ${agentStatus}`}>
              {agentName || 'Agent'} {agentStatus === 'complete' ? 'done' : agentStatus}
            </span>
          )}
        </div>
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
