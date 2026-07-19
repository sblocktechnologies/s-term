import { useCallback, useEffect, useState } from 'react';
import { AgentIcon, CheckIcon, CloseIcon, PlugIcon } from '../icons';

interface IntegrationsModalProps {
  open: boolean;
  onClose: () => void;
  onStatusChange?: (integrations: IntegrationStatus[]) => void;
}

export default function IntegrationsModal({ open, onClose, onStatusChange }: IntegrationsModalProps) {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await window.sterm.integrations.list();
      setIntegrations(next);
      onStatusChange?.(next);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not inspect integrations');
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const installDetected = async () => {
    const pending = integrations.filter((integration) => integration.detected && integration.status !== 'installed');
    if (pending.length === 0) return;
    setBusyId('all');
    setError('');
    try {
      for (const integration of pending) {
        await window.sterm.integrations.install(integration.id);
      }
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not install the detected integrations');
    } finally {
      setBusyId(undefined);
    }
  };

  const runAction = async (integration: IntegrationStatus, action: 'install' | 'uninstall') => {
    setBusyId(integration.id);
    setError('');
    try {
      await window.sterm.integrations[action](integration.id);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Could not ${action} the integration`);
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="integrations-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="integrations-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon"><PlugIcon /></span>
            <div>
              <h2 id="integrations-title">Agent integrations</h2>
              <p>Connect agent lifecycle events to terminal status.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close integrations">
            <CloseIcon />
          </button>
        </header>

        <div className="integration-intro">
          <span>Integrations are installed locally from the files bundled with S-Term. Existing agent settings are merged and backed up.</span>
          <button
            type="button"
            disabled={busyId === 'all' || !integrations.some((item) => item.detected && item.status !== 'installed')}
            onClick={() => void installDetected()}
          >
            {busyId === 'all' ? 'Installing...' : 'Install detected'}
          </button>
        </div>

        <div className="integration-list">
          {integrations.length === 0 && !error ? (
            <div className="integration-loading">Inspecting this machine...</div>
          ) : integrations.map((integration) => {
            const installed = integration.status === 'installed';
            const needsRepair = integration.status === 'needs-repair';
            const busy = busyId === integration.id || busyId === 'all';
            return (
              <article className="integration-card" key={integration.id}>
                <div className={`integration-logo ${integration.id}`}>
                  <AgentIcon />
                </div>
                <div className="integration-copy">
                  <div className="integration-name-row">
                    <h3>{integration.name}</h3>
                    <span className={`integration-status ${integration.status}`}>
                      {installed && <CheckIcon />}
                      {installed ? 'Installed' : needsRepair ? 'Needs repair' : integration.detected ? 'Detected' : 'Not detected'}
                    </span>
                  </div>
                  <p>{integration.description}</p>
                  {integration.note && <small>{integration.note}</small>}
                  {integration.detail && <small className="integration-error-text">{integration.detail}</small>}
                </div>
                <div className="integration-actions">
                  {installed ? (
                    <button type="button" className="integration-remove" disabled={busy} onClick={() => void runAction(integration, 'uninstall')}>
                      {busyId === integration.id ? 'Removing...' : 'Remove'}
                    </button>
                  ) : (
                    <button type="button" className="integration-install" disabled={busy} onClick={() => void runAction(integration, 'install')}>
                      {busy ? 'Installing...' : needsRepair ? 'Repair' : 'Install'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {error && <div className="modal-error" role="alert">{error}</div>}

        <footer className="modal-footer">
          <span>Changes take effect the next time the agent starts. Pi can also use /reload.</span>
          <button type="button" onClick={() => void refresh()}>Refresh</button>
        </footer>
      </section>
    </div>
  );
}
