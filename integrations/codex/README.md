# Codex integration

The installer safely merges S-Term handlers into Codex's user `hooks.json`.

Reported events:

- `UserPromptSubmit`: working
- `PermissionRequest`: attention
- `PostToolUse`: working again after attention
- `Stop`: complete
- `SessionEnd`: idle

Codex requires new command hooks to be reviewed. Run `/hooks` once after installation and trust the S-Term handlers.

Existing hooks are retained. Uninstall removes only hook handlers that call S-Term's installed signal helper.
