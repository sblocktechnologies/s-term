import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TerminalPane from './components/TerminalPane';
import IntegrationsModal from './components/IntegrationsModal';
import TerminalLauncherModal from './components/TerminalLauncherModal';
import { agentDisplayName, type AgentProtocolMessage, type AgentState, type AgentTelemetry } from './agentProtocol.js';
import { newTerminalGridSlot } from './gridPlacement.js';
import sblockLogo from './assets/sblock-logo.svg';
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  GridIcon,
  GridPositionIcon,
  PlugIcon,
  PlusIcon,
  SinglePaneIcon,
  TerminalIcon,
} from './icons';

type LayoutMode = 'focus' | 'grid';
type SessionStatus = 'running' | 'exited';

interface SessionLaunch {
  type: 'pi-session';
  piSessionPath: string;
  piSessionId: string;
}

interface Session {
  id: string;
  name: string;
  title: string;
  status: SessionStatus;
  agentStatus: AgentState;
  agentName?: string;
  agentMessage?: string;
  telemetry?: AgentTelemetry;
  cwd?: string;
  agentStartedAt?: number;
  agentUpdatedAt?: number;
  unread: boolean;
  launch?: SessionLaunch;
}

interface InitialWorkspace {
  sessions: Session[];
  activeId: string;
  layout: LayoutMode;
  gridSlots: Array<string | null>;
}

const WORKSPACE_KEY = 'sterm:workspace-v3';
const GRID_POSITION_LABELS = ['Top left', 'Top right', 'Bottom left', 'Bottom right'] as const;
let terminalNumber = 0;

function makeSession(name?: string, id?: string, launch?: SessionLaunch, cwd?: string): Session {
  terminalNumber += 1;
  const sessionName = name || `Terminal ${terminalNumber}`;
  const numberedName = /^Terminal (\d+)$/.exec(sessionName);
  const savedNumber = numberedName ? Number(numberedName[1]) : 0;
  if (Number.isSafeInteger(savedNumber) && savedNumber < 100000) {
    terminalNumber = Math.max(terminalNumber, savedNumber);
  }
  return {
    id: id || crypto.randomUUID(),
    name: sessionName,
    title: sessionName,
    status: 'running',
    agentStatus: 'idle',
    unread: false,
    launch,
    cwd,
  };
}

function defaultWorkspace(): InitialWorkspace {
  return {
    sessions: [],
    activeId: '',
    layout: 'focus',
    gridSlots: [null, null, null, null],
  };
}

function loadWorkspace(): InitialWorkspace {
  const workspace = defaultWorkspace();
  try {
    const value = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null') as {
      sessions?: Array<{ id?: unknown; name?: unknown; launch?: unknown; cwd?: unknown }>;
      activeId?: unknown;
      layout?: unknown;
      gridSlots?: unknown[];
    } | null;
    if (!value) return workspace;
    workspace.layout = value.layout === 'grid' ? 'grid' : 'focus';
    if (!Array.isArray(value.sessions)) return workspace;

    const seen = new Set<string>();
    const sessions = value.sessions.flatMap((item) => {
      const id = typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(item.id) ? item.id : '';
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : '';
      const rawLaunch = item.launch as Partial<SessionLaunch> | undefined;
      const launch = rawLaunch?.type === 'pi-session' &&
        typeof rawLaunch.piSessionPath === 'string' && rawLaunch.piSessionPath.length <= 4096 &&
        typeof rawLaunch.piSessionId === 'string'
        ? {
            type: 'pi-session' as const,
            piSessionPath: rawLaunch.piSessionPath,
            piSessionId: rawLaunch.piSessionId.slice(0, 80),
          }
        : undefined;
      const cwd = typeof item.cwd === 'string' && item.cwd.length <= 4096 ? item.cwd : undefined;
      return [makeSession(name || undefined, id, launch, cwd)];
    });
    if (sessions.length === 0) return workspace;

    const sessionIds = new Set(sessions.map((session) => session.id));
    const usedSlots = new Set<string>();
    const savedSlots = Array.isArray(value.gridSlots) ? value.gridSlots.slice(0, 4) : [];
    const gridSlots = Array.from({ length: 4 }, (_, index) => {
      const id = savedSlots[index];
      if (typeof id !== 'string' || !sessionIds.has(id) || usedSlots.has(id)) return null;
      usedSlots.add(id);
      return id;
    });
    const activeId = typeof value.activeId === 'string' && sessionIds.has(value.activeId)
      ? value.activeId
      : sessions[0].id;

    return { sessions, activeId, layout: workspace.layout, gridSlots };
  } catch {
    return workspace;
  }
}

function formatDuration(startedAt: number | undefined, now: number) {
  if (!startedAt) return '';
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function sessionSubtitle(session: Session, now: number) {
  const agent = agentDisplayName(session.agentName);
  if (session.agentStatus === 'working') {
    const duration = formatDuration(session.agentStartedAt, now);
    return `${agent} working${duration ? ` · ${duration}` : ''}`;
  }
  if (session.agentStatus === 'attention') return `${agent} needs attention`;
  if (session.agentStatus === 'complete') return `${agent} completed`;
  if (session.agentStatus === 'error') return `${agent} reported an error`;
  return session.title;
}

export default function App() {
  const initialRef = useRef<InitialWorkspace | null>(null);
  if (!initialRef.current) initialRef.current = loadWorkspace();
  const initial = initialRef.current;

  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [layout, setLayout] = useState<LayoutMode>(initial.layout);
  const [gridSlots, setGridSlots] = useState<Array<string | null>>(initial.gridSlots);
  const [selectedGridSlot, setSelectedGridSlot] = useState(() => {
    const initialSlot = initial.gridSlots.indexOf(initial.activeId);
    return initialSlot >= 0 ? initialSlot : 0;
  });
  const [version, setVersion] = useState('');
  const [now, setNow] = useState(Date.now());
  const [terminalLauncherOpen, setTerminalLauncherOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [integrationStatuses, setIntegrationStatuses] = useState<IntegrationStatus[]>([]);

  const sessionsRef = useRef(sessions);
  const activeIdRef = useRef(activeId);
  const layoutRef = useRef(layout);
  const gridSlotsRef = useRef(gridSlots);
  const selectedGridSlotRef = useRef(selectedGridSlot);
  sessionsRef.current = sessions;
  activeIdRef.current = activeId;
  layoutRef.current = layout;
  gridSlotsRef.current = gridSlots;
  selectedGridSlotRef.current = selectedGridSlot;

  const commitGridSlots = useCallback((next: Array<string | null>) => {
    const normalized = Array.from({ length: 4 }, (_, index) => next[index] || null);
    gridSlotsRef.current = normalized;
    setGridSlots(normalized);
  }, []);

  const placeInGrid = useCallback((terminalId: string, slot: number) => {
    if (slot < 0 || slot > 3) return;
    const next = gridSlotsRef.current.map((id) => id === terminalId ? null : id);
    next[slot] = terminalId;
    commitGridSlots(next);
    selectedGridSlotRef.current = slot;
    setSelectedGridSlot(slot);
  }, [commitGridSlots]);

  const markRead = useCallback((id: string) => {
    setSessions((current) => {
      if (!current.some((session) => session.id === id && session.unread)) return current;
      const next = current.map((session) => session.id === id ? { ...session, unread: false } : session);
      sessionsRef.current = next;
      return next;
    });
  }, []);

  const selectSession = useCallback((id: string) => {
    if (layoutRef.current === 'grid') {
      const existingSlot = gridSlotsRef.current.indexOf(id);
      if (existingSlot >= 0) {
        selectedGridSlotRef.current = existingSlot;
        setSelectedGridSlot(existingSlot);
      } else {
        placeInGrid(id, selectedGridSlotRef.current);
      }
    }
    activeIdRef.current = id;
    setActiveId(id);
    markRead(id);
  }, [markRead, placeInGrid]);

  const addTerminalSession = useCallback((session: Session) => {
    const next = [...sessionsRef.current, session];
    sessionsRef.current = next;
    setSessions(next);
    activeIdRef.current = session.id;
    setActiveId(session.id);
    if (layoutRef.current === 'grid') placeInGrid(session.id, selectedGridSlotRef.current);
  }, [placeInGrid]);

  const newTerminal = useCallback(() => {
    addTerminalSession(makeSession());
  }, [addTerminalSession]);

  const resumePiSession = useCallback((piSession: PiSessionSummary) => {
    const sessionLabel = piSession.name || piSession.firstPrompt || piSession.project;
    const name = `Pi · ${sessionLabel}`.slice(0, 80);
    addTerminalSession(makeSession(name, undefined, {
      type: 'pi-session',
      piSessionPath: piSession.path,
      piSessionId: piSession.id,
    }, piSession.cwd));
  }, [addTerminalSession]);

  const newTerminalInPane = useCallback(async (sourceId: string) => {
    const sourceBeforeLookup = sessionsRef.current.find((session) => session.id === sourceId);
    if (!sourceBeforeLookup) return;

    let shellCwd: string | null = null;
    try {
      shellCwd = await window.sterm.terminal.getCwd(sourceId);
    } catch {
      // The source shell may have exited while the request was in flight.
    }

    const source = sessionsRef.current.find((session) => session.id === sourceId);
    if (!source) return;
    const cwd = source.telemetry?.cwd || shellCwd || source.cwd;
    const session = makeSession(undefined, undefined, undefined, cwd);
    const next = [...sessionsRef.current, session];
    sessionsRef.current = next;
    setSessions(next);
    activeIdRef.current = session.id;
    setActiveId(session.id);

    if (layoutRef.current === 'grid') {
      const targetSlot = newTerminalGridSlot(
        gridSlotsRef.current,
        sourceId,
        selectedGridSlotRef.current,
      );
      placeInGrid(session.id, targetSlot);
    }
  }, [placeInGrid]);

  const closeTerminal = useCallback((id: string) => {
    const current = sessionsRef.current;
    const closingIndex = current.findIndex((session) => session.id === id);
    if (closingIndex < 0) return;

    void window.sterm.terminal.kill(id);
    const next = current.filter((session) => session.id !== id);

    sessionsRef.current = next;
    setSessions(next);
    const nextSlots = gridSlotsRef.current.map((slotId) => slotId === id ? null : slotId);
    commitGridSlots(nextSlots);

    if (activeIdRef.current === id) {
      const nextActive = next[Math.min(closingIndex, next.length - 1)]?.id || '';
      activeIdRef.current = nextActive;
      setActiveId(nextActive);
    }
  }, [commitGridSlots]);

  const updateSession = useCallback((id: string, patch: Partial<Pick<Session, 'title' | 'status' | 'telemetry' | 'agentStatus' | 'cwd'>>) => {
    setSessions((current) => {
      const session = current.find((item) => item.id === id);
      if (!session || Object.entries(patch).every(([key, value]) => session[key as keyof Session] === value)) {
        return current;
      }
      const next = current.map((item) => item.id === id ? { ...item, ...patch } : item);
      sessionsRef.current = next;
      return next;
    });
  }, []);

  const handleAgentSignal = useCallback((id: string, signal: AgentProtocolMessage) => {
    if (signal.event === 'telemetry') {
      setSessions((current) => {
        const next = current.map((session) => session.id === id
          ? { ...session, agentName: signal.agent, telemetry: signal, cwd: signal.cwd || session.cwd }
          : session);
        sessionsRef.current = next;
        return next;
      });
      return;
    }

    const timestamp = Date.now();
    const viewed = activeIdRef.current === id && document.hasFocus();
    const notable = signal.state === 'attention' || signal.state === 'complete' || signal.state === 'error';
    const sessionName = sessionsRef.current.find((session) => session.id === id)?.name || 'Terminal';

    setSessions((current) => {
      const next = current.map((session) => {
        if (session.id !== id) return session;
        const startedAt = signal.state === 'working'
          ? session.agentStatus === 'working' ? session.agentStartedAt : timestamp
          : session.agentStartedAt;
        return {
          ...session,
          agentStatus: signal.state,
          agentName: signal.agent,
          agentMessage: signal.message,
          agentStartedAt: startedAt,
          agentUpdatedAt: timestamp,
          unread: notable ? !viewed : false,
        };
      });
      sessionsRef.current = next;
      return next;
    });

    if (notable && !viewed) {
      const agent = agentDisplayName(signal.agent);
      const action = signal.state === 'complete' ? 'finished' : signal.state === 'attention' ? 'needs attention' : 'reported an error';
      window.sterm.notify({
        title: `${agent} ${action}`,
        body: `${sessionName}: ${signal.message || action}`,
      });
    }
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    layoutRef.current = mode;
    setLayout(mode);
    if (mode !== 'grid') return;

    if (!activeIdRef.current) return;

    const slot = gridSlotsRef.current.indexOf(activeIdRef.current);
    if (slot >= 0) {
      selectedGridSlotRef.current = slot;
      setSelectedGridSlot(slot);
      return;
    }

    const selectedSlot = selectedGridSlotRef.current;
    const selectedTerminal = gridSlotsRef.current[selectedSlot];
    if (selectedTerminal) {
      activeIdRef.current = selectedTerminal;
      setActiveId(selectedTerminal);
      markRead(selectedTerminal);
    } else {
      placeInGrid(activeIdRef.current, selectedSlot);
    }
  }, [markRead, placeInGrid]);

  useEffect(() => {
    void window.sterm.getVersion().then(setVersion);
    void window.sterm.integrations.list().then(setIntegrationStatuses).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({
      sessions: sessions.map(({ id, name, launch, cwd }) => ({ id, name, launch, cwd })),
      activeId,
      layout,
      gridSlots,
    }));
  }, [activeId, gridSlots, layout, sessions]);

  useEffect(() => window.sterm.onCommand((command) => {
    if (command === 'new-terminal') {
      setTerminalLauncherOpen(false);
      newTerminal();
    }
    else if (command === 'focus-layout') setLayoutMode('focus');
    else if (command === 'grid-layout') setLayoutMode('grid');
    else if (command === 'close-terminal' && activeId) closeTerminal(activeId);
    else window.dispatchEvent(new CustomEvent('sterm:terminal-command', { detail: command }));
  }), [activeId, closeTerminal, newTerminal, setLayoutMode]);

  const visibleOrder = useMemo(() => {
    if (layout === 'focus') return new Map([[activeId, 0]]);
    return new Map(gridSlots.flatMap((id, index) => id ? [[id, index] as [string, number]] : []));
  }, [activeId, gridSlots, layout]);

  const activeSession = sessions.find((session) => session.id === activeId) ?? sessions[0];
  const workingCount = sessions.filter((session) => session.agentStatus === 'working').length;
  const attentionCount = sessions.filter((session) => session.agentStatus === 'attention').length;
  const unreadCount = sessions.filter((session) => session.unread).length;
  const integrationsNeedSetup = integrationStatuses.filter((item) => item.detected && item.status !== 'installed').length;

  return (
    <div className={`app platform-${window.sterm.platform}`}>
      <aside className="sidebar">
        <div className="brand-row drag-region">
          <div className="brand no-drag">
            <span className="brand-mark"><img src={sblockLogo} alt="S-Block" /></span>
            <span>S-Term</span>
          </div>
        </div>

        <div className="sidebar-heading">
          <span className="sidebar-heading-label">
            Terminals
            <button type="button" className="sidebar-add-button" title="Open terminal" aria-label="Open terminal" onClick={() => setTerminalLauncherOpen(true)}>
              <PlusIcon />
            </button>
          </span>
          <span>{sessions.length}</span>
        </div>

        {(workingCount > 0 || attentionCount > 0 || unreadCount > 0) && (
          <div className="agent-summary" aria-label="Agent activity summary">
            {workingCount > 0 && <span className="summary-working"><i />{workingCount} working</span>}
            {attentionCount > 0 && <span className="summary-attention"><AlertIcon />{attentionCount}</span>}
            {unreadCount > 0 && <span className="summary-complete"><CheckIcon />{unreadCount}</span>}
          </div>
        )}

        <nav className="session-list" aria-label="Terminals">
          {sessions.map((session, index) => {
            const slot = gridSlots.indexOf(session.id);
            return (
              <button
                type="button"
                key={session.id}
                draggable
                className={`session-item${session.id === activeId ? ' active' : ''}${session.unread ? ' unread' : ''}`}
                onClick={() => selectSession(session.id)}
                onDoubleClick={() => setLayoutMode('focus')}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('application/x-sterm-terminal', session.id);
                }}
              >
                <span className="session-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="session-copy">
                  <span className="session-name">{session.name}</span>
                  <span className={`session-title agent-${session.agentStatus}`}>{sessionSubtitle(session, now)}</span>
                </span>
                {slot >= 0 && (
                  <span className="session-grid-slot" title={`${GRID_POSITION_LABELS[slot]} grid position`}>
                    <GridPositionIcon position={slot} />
                  </span>
                )}
                <span className={`agent-indicator ${session.agentStatus}${session.unread ? ' unread' : ''}`} title={sessionSubtitle(session, now)}>
                  {session.agentStatus === 'complete' && <CheckIcon />}
                  {session.agentStatus === 'attention' && <AlertIcon />}
                  {session.agentStatus === 'error' && <span>!</span>}
                </span>
                <span
                  role="button"
                  tabIndex={-1}
                  className="session-close"
                  aria-label={`Close ${session.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTerminal(session.id);
                  }}
                >
                  <CloseIcon />
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="integrations-button" onClick={() => setIntegrationsOpen(true)}>
            <PlugIcon />
            <span>Agent integrations</span>
            {integrationsNeedSetup > 0 ? <i className="setup-count">{integrationsNeedSetup}</i> : <ChevronIcon />}
          </button>
          <div className="version">S-Term{version ? ` ${version}` : ''}</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="toolbar drag-region">
          <div className="workspace-title no-drag">
            <span>{layout === 'focus' ? activeSession?.name || 'No terminal' : `${GRID_POSITION_LABELS[selectedGridSlot]} grid position`}</span>
            <ChevronIcon />
          </div>
          <div className="toolbar-actions no-drag">
            {layout === 'grid' && (
              <div className="grid-slot-picker" aria-label="Selected grid slot">
                {gridSlots.map((terminalId, index) => {
                  const session = sessions.find((item) => item.id === terminalId);
                  return (
                    <button
                      type="button"
                      key={index}
                      className={`${selectedGridSlot === index ? 'selected' : ''}${terminalId ? ' filled' : ''}`}
                      title={session ? `${GRID_POSITION_LABELS[index]}: ${session.name}` : `Select empty ${GRID_POSITION_LABELS[index].toLowerCase()} position`}
                      aria-label={session ? `${GRID_POSITION_LABELS[index]} grid position: ${session.name}` : `Select empty ${GRID_POSITION_LABELS[index].toLowerCase()} grid position`}
                      onClick={() => {
                        selectedGridSlotRef.current = index;
                        setSelectedGridSlot(index);
                        if (terminalId) selectSession(terminalId);
                      }}
                    >
                      <GridPositionIcon position={index} />
                      {session && <i className={`slot-state ${session.agentStatus}`} />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="layout-switcher" aria-label="Layout">
              <button type="button" className={layout === 'focus' ? 'active' : ''} title="Focus mode (Cmd/Ctrl + 1)" aria-label="Focus mode" onClick={() => setLayoutMode('focus')}>
                <SinglePaneIcon /><span>Focus</span>
              </button>
              <button type="button" className={layout === 'grid' ? 'active' : ''} title="Four pane mode (Cmd/Ctrl + 4)" aria-label="Four pane mode" onClick={() => setLayoutMode('grid')}>
                <GridIcon /><span>Grid</span>
              </button>
            </div>
          </div>
        </header>

        <div className={`workspace ${layout}`}>
          {layout === 'focus' && sessions.length === 0 && (
            <div className="empty-workspace-state">
              <span><TerminalIcon /></span>
              <strong>No terminals open</strong>
              <small>Use the + beside Terminals to open one.</small>
            </div>
          )}

          {sessions.map((session) => {
            const order = visibleOrder.get(session.id);
            return (
              <TerminalPane
                key={session.id}
                id={session.id}
                name={session.name}
                title={session.title}
                status={session.status}
                piSessionPath={session.launch?.piSessionPath}
                initialCwd={session.cwd}
                piMode={session.launch?.type === 'pi-session' || session.agentName === 'pi'}
                agentStatus={session.agentStatus}
                agentName={agentDisplayName(session.agentName)}
                telemetry={session.telemetry}
                active={session.id === activeId}
                visible={order !== undefined}
                order={order ?? 99}
                gridSlot={layout === 'grid' && order !== undefined ? order + 1 : undefined}
                onActivate={() => {
                  if (layout === 'grid' && order !== undefined) {
                    selectedGridSlotRef.current = order;
                    setSelectedGridSlot(order);
                  }
                  activeIdRef.current = session.id;
                  setActiveId(session.id);
                  markRead(session.id);
                }}
                onClose={() => closeTerminal(session.id)}
                onTitleChange={(title) => updateSession(session.id, { title })}
                onStatusChange={(status) => updateSession(session.id, {
                  status,
                  ...(status === 'exited' ? { telemetry: undefined, agentStatus: 'idle' as const } : {}),
                })}
                onCwdChange={(cwd) => updateSession(session.id, { cwd })}
                onNewTerminalHere={() => void newTerminalInPane(session.id)}
                onAgentSignal={(signal) => handleAgentSignal(session.id, signal)}
                onFocusMode={() => {
                  activeIdRef.current = session.id;
                  setActiveId(session.id);
                  setLayoutMode('focus');
                  markRead(session.id);
                }}
                onRemoveFromGrid={layout === 'grid' && order !== undefined ? () => {
                  const next = [...gridSlotsRef.current];
                  next[order] = null;
                  commitGridSlots(next);
                  if (activeIdRef.current === session.id) {
                    const nextActive = next.find((terminalId): terminalId is string => Boolean(terminalId));
                    if (nextActive) {
                      activeIdRef.current = nextActive;
                      setActiveId(nextActive);
                      markRead(nextActive);
                    }
                  }
                } : undefined}
                onTerminalDrop={layout === 'grid' && order !== undefined ? (terminalId) => {
                  placeInGrid(terminalId, order);
                  selectSession(terminalId);
                } : undefined}
              />
            );
          })}

          {layout === 'grid' && gridSlots.map((terminalId, index) => terminalId ? null : (
            <button
              type="button"
              className={`empty-pane${selectedGridSlot === index ? ' selected' : ''}`}
              style={{ order: index }}
              key={`empty-${index}`}
              onClick={() => {
                selectedGridSlotRef.current = index;
                setSelectedGridSlot(index);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const terminalIdToPlace = event.dataTransfer.getData('application/x-sterm-terminal');
                if (terminalIdToPlace) {
                  placeInGrid(terminalIdToPlace, index);
                  selectSession(terminalIdToPlace);
                }
              }}
            >
              <span><GridPositionIcon position={index} /></span>
              <strong>{GRID_POSITION_LABELS[index]}</strong>
              <small>{sessions.length === 0 ? 'Use + beside Terminals to open one' : 'Click this slot, then choose a sidebar tab'}</small>
            </button>
          ))}
        </div>
      </main>

      <TerminalLauncherModal
        open={terminalLauncherOpen}
        onClose={() => setTerminalLauncherOpen(false)}
        onNewShell={() => {
          setTerminalLauncherOpen(false);
          newTerminal();
        }}
        onResumePiSession={(piSession) => {
          setTerminalLauncherOpen(false);
          resumePiSession(piSession);
        }}
      />

      <IntegrationsModal
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        onStatusChange={setIntegrationStatuses}
      />
    </div>
  );
}
