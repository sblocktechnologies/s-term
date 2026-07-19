# Claude Code integration

The installer safely merges S-Term handlers into Claude Code's user `settings.json`.

Reported events:

- `UserPromptSubmit`: working
- `PermissionRequest`: attention
- `PostToolUse`: working again after attention
- `Stop`: complete
- `SessionEnd`: idle

Existing settings and hooks are retained. Uninstall removes only hook handlers that call S-Term's installed signal helper.
