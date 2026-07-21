# Claude Code integration

The installer safely merges S-Term handlers into Claude Code's user `settings.json`.

Reported events:

- `UserPromptSubmit`: working
- `PermissionRequest`: attention
- `PostToolUse`: working again after attention
- `Stop`: complete
- `SessionEnd`: idle

The integration also installs a Claude status-line bridge. Inside S-Term, it sends current directory, Git state, model, reasoning effort, tokens, context usage, subscription detection, and cost through OSC 777 without adding a visible custom status-line row. Outside S-Term, an existing user status-line command continues to run normally.

Existing settings, hooks, and status-line configuration are retained. Uninstall removes only S-Term handlers and restores the exact previous status-line configuration.
