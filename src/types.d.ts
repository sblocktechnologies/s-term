interface TerminalExitPayload {
  id: string;
  exitCode: number;
  signal?: number;
}

type AppCommand =
  | 'new-terminal'
  | 'focus-layout'
  | 'grid-layout'
  | 'close-terminal'
  | 'copy'
  | 'paste'
  | 'clear';

interface PiSessionSummary {
  id: string;
  path: string;
  cwd: string;
  project: string;
  name: string;
  firstPrompt: string;
  messageCount: number;
  createdAt: number;
  modifiedAt: number;
}

interface IntegrationStatus {
  id: 'pi' | 'claude-code' | 'codex';
  name: string;
  command: string;
  description: string;
  note?: string;
  detected: boolean;
  status: 'installed' | 'needs-repair' | 'not-installed';
  detail?: string;
}

interface IntegrationDoctorResult {
  ok: boolean;
  integrations: IntegrationStatus[];
  issues: string[];
}

interface Window {
  sterm: {
    platform: 'darwin' | 'win32' | 'linux';
    terminal: {
      create: (options: {
        id: string;
        cols: number;
        rows: number;
        cwd?: string;
        piSessionPath?: string;
      }) => Promise<{ pid: number; cwd: string }>;
      write: (id: string, data: string) => void;
      resize: (id: string, cols: number, rows: number) => void;
      kill: (id: string) => Promise<void>;
      getCwd: (id: string) => Promise<string | null>;
      showContextMenu: (id: string, canCopy: boolean) => Promise<void>;
      onData: (id: string, callback: (data: string) => void) => () => void;
      onExit: (id: string, callback: (payload: TerminalExitPayload) => void) => () => void;
    };
    clipboard: {
      hasImage: () => boolean;
      readText: () => string;
      saveImage: (terminalId: string) => Promise<string | null>;
      writeText: (text: string) => void;
    };
    piSessions: {
      list: (limit?: number) => Promise<PiSessionSummary[]>;
    };
    integrations: {
      list: () => Promise<IntegrationStatus[]>;
      install: (id: IntegrationStatus['id']) => Promise<IntegrationStatus>;
      uninstall: (id: IntegrationStatus['id']) => Promise<IntegrationStatus>;
      doctor: () => Promise<IntegrationDoctorResult>;
    };
    openExternal: (url: string) => Promise<boolean>;
    notify: (payload: { title: string; body: string }) => void;
    onCommand: (callback: (command: AppCommand) => void) => () => void;
    getVersion: () => Promise<string>;
  };
}
