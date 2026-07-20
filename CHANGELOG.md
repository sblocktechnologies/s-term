# Changelog

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
