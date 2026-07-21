# Changelog

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
