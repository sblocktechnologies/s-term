# S-Term integrations

This directory is the canonical source for all S-Term agent integrations.

- `protocol/`: OSC 777 status protocol
- `generic/`: portable shell and PowerShell signal helpers
- `pi/`: Pi lifecycle extension
- `claude-code/`: Claude Code hook documentation
- `codex/`: Codex hook documentation

Use the application Integrations panel or the repository scripts to install them. The installer copies versioned runtime files to the user's home directory because agent CLIs only discover integrations from their own configuration locations.

```bash
npm run integrations:status
npm run integrations:install
npm run integrations:doctor
npm run integrations:uninstall
```

Install and uninstall operations are idempotent. Existing configuration is merged, backed up, and never replaced wholesale.
