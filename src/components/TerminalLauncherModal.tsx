import { useEffect, useMemo, useRef, useState } from 'react';
import { AgentIcon, ChevronIcon, CloseIcon, FolderIcon, SearchIcon, TerminalIcon } from '../icons';

interface TerminalLauncherModalProps {
  open: boolean;
  onClose: () => void;
  onNewShell: () => void;
  onResumePiSession: (session: PiSessionSummary) => void;
}

function relativeTime(timestamp: number) {
  const elapsed = timestamp - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absolute < 60_000) return formatter.format(Math.round(elapsed / 1000), 'second');
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), 'minute');
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), 'hour');
  if (absolute < 2_592_000_000) return formatter.format(Math.round(elapsed / 86_400_000), 'day');
  return formatter.format(Math.round(elapsed / 2_592_000_000), 'month');
}

function sessionTitle(session: PiSessionSummary) {
  return session.name || session.firstPrompt || `Pi session ${session.id.slice(0, 8)}`;
}

function displayPath(cwd: string) {
  const home = cwd.match(/^\/Users\/[^/]+|^\/home\/[^/]+/)?.[0];
  return home ? `~${cwd.slice(home.length)}` : cwd;
}

export default function TerminalLauncherModal({
  open,
  onClose,
  onNewShell,
  onResumePiSession,
}: TerminalLauncherModalProps) {
  const [sessions, setSessions] = useState<PiSessionSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setQuery('');
    void window.sterm.piSessions.list()
      .then(setSessions)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Could not load Pi sessions'))
      .finally(() => setLoading(false));
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sessions;
    return sessions.filter((session) => [
      session.name,
      session.firstPrompt,
      session.project,
      session.cwd,
      session.id,
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [query, sessions]);

  if (!open) return null;

  const loadAllSessions = async () => {
    setLoadingMore(true);
    setError('');
    try {
      setSessions(await window.sterm.piSessions.list(2000));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load older Pi sessions');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="modal-backdrop launcher-backdrop" onMouseDown={onClose}>
      <section
        className="terminal-launcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-launcher-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="launcher-header">
          <div>
            <h2 id="terminal-launcher-title">Open terminal</h2>
            <p>Start a shell or continue a local Pi session.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close terminal launcher">
            <CloseIcon />
          </button>
        </header>

        <button type="button" className="new-shell-option" onClick={onNewShell}>
          <span className="launcher-option-icon"><TerminalIcon /></span>
          <span className="launcher-option-copy">
            <strong>New terminal</strong>
            <small>Open your default login shell</small>
          </span>
          <span className="launcher-shortcut">{window.sterm.platform === 'darwin' ? '⌘⇧T' : 'Ctrl ⇧ T'}</span>
          <ChevronIcon />
        </button>

        <div className="launcher-section-heading">
          <span><AgentIcon /> Resume Pi session</span>
          <span>{sessions.length === 200 ? '200+' : sessions.length}</span>
        </div>

        <label className="session-search">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions, projects, or paths"
            aria-label="Search Pi sessions"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><CloseIcon /></button>}
        </label>

        <div className="pi-session-list">
          {loading ? (
            <div className="launcher-empty"><span className="launcher-spinner" />Loading Pi sessions...</div>
          ) : error ? (
            <div className="launcher-empty error">{error}</div>
          ) : filteredSessions.length === 0 ? (
            <div className="launcher-empty">
              {query ? 'No sessions match your search.' : 'No saved Pi sessions were found.'}
            </div>
          ) : filteredSessions.map((session) => (
            <button
              type="button"
              className="pi-session-option"
              key={session.path}
              onClick={() => onResumePiSession(session)}
            >
              <span className="pi-session-icon"><AgentIcon /></span>
              <span className="pi-session-copy">
                <strong>{sessionTitle(session)}</strong>
                <small>
                  <span><FolderIcon />{session.project}</span>
                  <span>{relativeTime(session.modifiedAt)}</span>
                  <span>{session.messageCount} messages</span>
                </small>
                <span className="pi-session-path">{displayPath(session.cwd)}</span>
              </span>
              <ChevronIcon className="pi-session-chevron" />
            </button>
          ))}
          {!query && sessions.length === 200 && (
            <button type="button" className="load-more-sessions" disabled={loadingMore} onClick={() => void loadAllSessions()}>
              {loadingMore ? <><span className="launcher-spinner" /> Loading older sessions...</> : 'Load all sessions'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
