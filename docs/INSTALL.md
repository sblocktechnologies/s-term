# Installing S-Term

## Release builds

S-Term packages are generated for:

- macOS as a DMG
- Windows as an NSIS installer
- Linux as an AppImage

A tagged release or manual run of `.github/workflows/build.yml` produces all three artifacts. Production distribution should add platform signing and macOS notarization credentials to the release environment.

## Build locally

Requirements:

- Node.js 22 or newer
- npm
- Standard native build tools for `node-pty`

```bash
npm ci
npm test
npm run package
```

Packages are written to `release/`.

## Unnotarized local builds

Local macOS packages can be code-signed without being notarized. On another Mac, open the Applications folder, Control-click S-Term, choose **Open**, then confirm **Open**. This approval is normally needed only once.

Public downloads should be signed with a Developer ID Application certificate and notarized so this extra approval is unnecessary.

## First run

1. Launch S-Term.
2. Open **Agent integrations** in the lower-left sidebar.
3. Select **Install detected**.
4. Restart the agent CLI in each terminal.
5. For Codex, run `/hooks` and trust the S-Term handlers.

No agent configuration is changed during application installation. Integrations are installed only after an explicit action in S-Term or through `npm run integrations:install`.

## Updating integrations

Open **Agent integrations** after updating S-Term. Integrations whose installed source differs from the bundled version appear as **Needs repair**. Select **Repair** to upgrade them.

## Uninstalling integrations

Use the Remove button for an individual integration, or run:

```bash
npm run integrations:uninstall
```

S-Term removes only its own extension or hook handlers. Existing agent hooks and settings remain intact.
