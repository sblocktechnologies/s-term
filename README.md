# S-Term

S-Term is a desktop terminal and AI agent control plane built with Electron, React, xterm.js, and native PTYs.

## Features

- Real shell sessions using your default login shell
- Focus mode for one terminal
- Four-slot grid mode
- Explicit grid tab selection and drag-and-drop placement
- One-click pane duplication into the same working directory
- Restores open terminal tabs after relaunch and stays empty when all tabs were closed
- Persistent tab names, sidebar drag ordering, and pinned tabs
- Agent working, attention, completed, and error indicators
- Searchable local Pi session launcher and one-click resume
- Clickable HTTP and HTTPS links in terminal output
- Unread completion badges and native background notifications
- Repository-owned integrations for Pi, Claude Code, and Codex
- Clipboard image attachments in Pi with secure temporary-path fallback in other terminals
- Agent metadata in pane headers: full Pi and Claude telemetry plus available Codex model, directory, Git, and reasoning data
- Native copy, paste, resize, and true color support

## Development

```bash
npm install
npm run dev
```

`npm install` installs application dependencies only. It does not modify agent configuration.

## Agent integrations

Open **Agent integrations** in the S-Term sidebar to detect, install, repair, or remove integrations. The application installs adapters from the files bundled with S-Term, so setup works without an additional download.

Repository commands are also available:

```bash
npm run integrations:status
npm run integrations:install
npm run integrations:doctor
npm run integrations:uninstall
```

The install command configures only agent CLIs detected on the current machine. A specific integration can be managed directly:

```bash
node scripts/integrations.mjs install pi
node scripts/integrations.mjs install claude-code
node scripts/integrations.mjs install codex
```

Existing JSON configuration is merged rather than replaced. Backups are stored under `~/.sterm/backups` with private file permissions. Install and uninstall operations are idempotent.

Codex requires new command hooks to be reviewed. Run `/hooks` in Codex after installation and trust the S-Term handlers.

## Agent status protocol

Integrations report lifecycle events through the terminal using S-Term's OSC 777 protocol. No local server, open port, credential, or cloud service is required. See [`integrations/protocol/README.md`](integrations/protocol/README.md) for the protocol and generic shell helper.

All canonical integration source lives under [`integrations/`](integrations/). Installed copies exist only because agent CLIs discover extensions and hooks from their own user configuration directories.

## Opening terminals and Pi sessions

Select the `+` beside **Terminals** to open the terminal launcher. Choose **New terminal** for a normal login shell, or search local sessions stored under `~/.pi/agent/sessions` and select one to resume it in a new tab. If an older workspace reopens a former Pi tab as a fresh shell, hover over that sidebar tab and use the agent action to replace it with the correct saved Pi session while preserving its tab and grid position.

`Cmd/Ctrl + Shift + T` remains a shortcut for opening a normal terminal immediately.

Sidebar tabs can be renamed by double-clicking their name, pressing `F2` while focused, or selecting the edit action on hover. Drag tabs above or below another tab in the same pinned or unpinned group to reorder them. Use the pin action to keep important tabs in a persistent group at the top. The recent-first button beside `+` sorts each pin group using the same timestamp displayed at the left of each tab. Sidebar order does not change grid pane placement. The compact value at the left of each tab shows time since its last meaningful agent message, falling back to time since the tab opened before the first message.

Open tabs are restored when S-Term is relaunched. Pi-backed tabs resume their saved Pi session. With the current Pi integration, Pi started manually inside a normal S-Term shell is promoted to a resumable tab after S-Term validates Pi's authoritative session file. Normal terminal tabs reopen as fresh login shells because their original shell processes end with the application. Closing every tab leaves the next launch empty.

Pi redraws are rendered atomically so wrapped drafts and streaming agent output remain stable. S-Term retains up to 100,000 xterm scrollback lines so large resumed sessions keep their rendered history. Switching between grid and focus layouts preserves Pi scrollback across terminal resizes. When Pi is idle, S-Term aligns its inline editor border with the bottom of the pane and prevents intentional downward scrolling into blank terminal rows. Upward scrollback remains available. Pi panes also support macOS editing conventions including `Cmd+Backspace` to clear the current draft.

## Selecting grid terminals

1. Switch to **Grid** mode.
2. Select one of the quadrant buttons in the toolbar or click an empty pane.
3. Click a terminal in the sidebar to place it in that slot.

You can also drag a sidebar terminal directly onto a pane. Drag a grid pane by its header to swap it with another pane or move it into an empty position. Clicking a terminal already assigned to the grid focuses its existing position. The grid button in a pane header removes that terminal from the grid without closing its shell.

The grid toolbar summarizes assigned panes and active agent states. Select a working, attention, complete, or error count to cycle focus through matching panes.

## Build and package

```bash
npm run build
npm test
npm run package
```

Packaged applications are written to `release/`. Integration files are included in the application resources for offline setup. See [`docs/INSTALL.md`](docs/INSTALL.md) for clean-machine installation and release build details.

Configured release targets:

- macOS DMG
- Windows NSIS installer
- Linux AppImage

## License

S-Term source code is available under the MIT License. S-Block names and brand assets are covered separately by [`BRANDING.md`](BRANDING.md).

## Shortcuts

- `Cmd/Ctrl + Shift + T`: New terminal
- `Cmd/Ctrl + 1`: Focus mode
- `Cmd/Ctrl + 4`: Grid mode
- `Cmd/Ctrl + W`: Close active terminal
- `Cmd + C/V` on macOS: Copy and paste text or images
- `Ctrl + Shift + C/V` on Windows and Linux: Copy and paste text or images
- `Cmd/Ctrl + K`: Clear terminal
- `Shift + Enter` in Pi: Insert a newline
- `Cmd + Left/Right` in Pi: Move to the start or end of the current line
- `Cmd + Up/Down` in Pi: Move to the start or end of the entire draft
- `Option + Left/Right` in Pi: Move backward or forward by one word
