# Changelog

## 0.3.14

### Added

- Added a recent-first sort button beside the sidebar terminal launcher
- Sorting uses the same last-message or opened-at timestamp displayed at the left of each tab
- Pinned tabs remain at the top and both pin groups are sorted independently
- The sorted order persists across application restarts and does not affect grid placement

## 0.3.13

### Fixed

- Increased xterm scrollback from 10,000 to 100,000 lines so large resumed Pi sessions retain their rendered conversation history
- Added a sidebar action for replacing a fresh generic shell with a selected saved Pi session without changing the tab or grid assignment
- Persisted detected agent identity as additional workspace recovery metadata

### Changed

- The terminal launcher clearly identifies when a saved Pi session will replace an existing fresh shell

## 0.3.12

### Changed

- Replaced sidebar ordinal numbers with compact time since the last meaningful agent message, such as `3s`, `10m`, `4h`, or `2d`
- Tabs without an agent message show time since they were opened
- Recency timestamps persist across application restarts
- Existing Pi tabs initialize recency from the validated session file modification time
- Pinned-tab recency uses the accent color while remaining visible

## 0.3.11

### Added

- Persistent user-defined terminal names with inline editing from double-click, `F2`, or the sidebar edit action
- Functional sidebar drag ordering with before and after insertion indicators
- Persistent pinned tabs grouped at the top of the sidebar

### Changed

- Sidebar order is independent from four-pane grid placement
- Opening an existing saved workspace normalizes pinned terminals without disturbing order inside each group

## 0.3.10

### Fixed

- Pi started manually inside a normal terminal is now promoted to a resumable Pi-backed tab
- Session paths reported by Pi are validated in the Electron main process before being persisted
- Opening the same Pi session from the launcher now selects its existing tab instead of creating a duplicate
- Duplicate Pi session records in a saved workspace are ignored during restoration

## 0.3.9

### Fixed

- Preserved Pi scrollback when focus and grid layout changes resize the terminal
- Pi's synchronized resize redraw no longer forwards its erase-scrollback command to xterm
- Removed resize-triggered viewport correction so layout changes do not create a second scroll operation
- Normal terminal clear behavior remains unchanged

## 0.3.8

### Changed

- macOS release builds now use a Developer ID Application certificate and hardened runtime
- Tagged macOS builds are submitted to Apple for notarization and have the approval ticket stapled before publication
- Signing and notarization credentials are supplied exclusively through GitHub Actions secrets

## 0.3.7

### Fixed

- Pinned the upstream xterm.js build containing its synchronized-output viewport fix
- Terminal DOM scrolling now waits for Pi's synchronized redraw to finish, eliminating line-count-dependent flicker while typing and streaming agent output
- Removed continuous Pi viewport correction from PTY output and terminal scroll events
- Blank-row correction now runs only after Pi settles, after a pane resize, or after intentional downward scrolling

## 0.3.6

### Added

- The grid toolbar now summarizes assigned pane count and nonzero working, attention, complete, and error states
- Clicking an activity count focuses the next matching pane and cycles through additional matches
- Activity labels collapse to compact colored counts when horizontal space is limited

## 0.3.5

### Changed

- Replaced the misleading grid-position dropdown-like label with a plain `Grid workspace` heading
- Grid destination selection remains available through the four quadrant buttons and empty panes

### Fixed

- Pi viewport correction now waits for terminal redraws to settle before inspecting content
- Stale scrollback exposed during a partial TUI redraw can no longer become an automatic scroll destination

## 0.3.4

### Added

- `Cmd+Backspace` clears the complete current Pi message draft on macOS

### Fixed

- Disabled smooth scrolling in Pi panes so idle viewport correction no longer fights editor redraws and causes screen jitter
- Other terminal types retain smooth scrolling

## 0.3.3

### Added

- Grid pane headers are now drag handles for rearranging pane positions
- Dropping onto an occupied pane swaps the two terminals
- Dropping onto an empty grid position moves the terminal there
- Sidebar terminal dragging remains unchanged

## 0.3.2

### Fixed

- Made the Claude lifecycle regression test portable across Windows, macOS, and Linux

## 0.3.1

### Added

- Added a pane-header `+` action that creates a terminal in the same working directory
- New terminals use the first empty grid position, or replace the clicked pane when all four positions are occupied
- Previous terminals remain open in the sidebar when their full-grid pane is replaced

### Fixed

- Prevented sparse Claude lifecycle-hook payloads from replacing rich status-line telemetry
- Claude pane headers now retain model, reasoning, token, context, Git, subscription, and cost fields after a turn completes
- Agent telemetry now retains absolute working directories while displaying compact home-relative paths

## 0.3.0

### Added

- Claude Code pane-header telemetry for directory, Git state, model, reasoning effort, tokens, context, subscription, and cost
- Codex pane-header telemetry for directory, Git state, active model, and configured reasoning effort
- Safe Claude status-line bridging that restores an existing user status line on uninstall
- Pi-specific viewport alignment that prevents scrolling into blank rows below the idle editor

### Changed

- Codex integration now uses the documented `SessionStart` hook for initial idle state
- Runtime agent hooks now consume structured hook input through the shared telemetry helper
- Integration runtime health checks now validate the telemetry helper alongside shell and PowerShell signals

## 0.2.1

### Changed

- Replaced numeric grid-slot labels with visual 2×2 position icons
- Added explicit top-left, top-right, bottom-left, and bottom-right accessibility labels
- Applied position icons consistently in the toolbar, pane headers, sidebar badges, and empty grid panes

## 0.2.0

### Added

- Clipboard image attachments for Pi through the native Pi image workflow
- Secure temporary PNG path fallback for non-Pi terminals
- Copy, paste, and clear terminal context menu
- Pi working directory, Git branch, and dirty-state metadata in pane headers
- Pi token, cache, context, subscription, cost, model, provider, and reasoning telemetry
- Responsive telemetry display for focus and grid layouts

### Changed

- Pi's built-in footer is hidden inside compatible S-Term versions to avoid duplicated metadata
- Text paste now uses xterm's native paste path and bracketed-paste support

### Security

- Temporary clipboard images use randomized names, restricted permissions, size limits, and terminal-scoped cleanup
- OSC telemetry is length-limited, field-validated, and never includes authentication data

## 0.1.1

### Added

- Shift+Enter inserts a newline in Pi drafts
- Command+Left and Command+Right move to line boundaries
- Command+Up and Command+Down move to whole-draft boundaries
- Option+Left and Option+Right move by word
- Pi-specific keyboard handling leaves normal terminal applications unchanged

## 0.1.0

Initial S-Term release.

### Included

- Real PTY-backed terminal tabs
- Focus and four-pane grid layouts
- Explicit grid slot assignment
- Local Pi session discovery and resume
- Pi, Claude Code, and Codex agent status integrations
- Working, attention, completion, and unread indicators
- Clickable HTTP and HTTPS terminal links
- Open-tab restoration across application relaunches
- Offline integration installation, repair, and removal
- macOS, Windows, and Linux packaging configuration
