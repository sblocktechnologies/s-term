# Codex integration

The installer safely merges S-Term handlers into Codex's user `hooks.json`.

Reported events:

- `SessionStart`: idle
- `UserPromptSubmit`: working
- `PermissionRequest`: attention
- `PostToolUse`: working again after attention
- `Stop`: complete

Hook input supplies current directory and the active model. The S-Term helper adds Git branch and dirty state, then reads the configured reasoning effort when available. Codex does not currently expose live token, context, subscription, or cost totals through hooks, so those fields are omitted rather than inferred.

Codex requires new command hooks to be reviewed. Run `/hooks` once after installation and trust the S-Term handlers.

Existing hooks are retained. Uninstall removes only hook handlers that call S-Term's installed helper.
