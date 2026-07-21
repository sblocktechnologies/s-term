# Pi integration

This extension reports Pi agent lifecycle events to the S-Term tab that contains Pi. It also adds whole-draft cursor navigation, draft clearing, and S-Term image-paste handling.

Inside S-Term v0.2.0 or later, the extension sends current-directory, Git, token, context, model, subscription, and reasoning telemetry to the pane header. Pi's built-in footer is hidden there to avoid duplicate information. Pi running in another terminal keeps its normal footer.

The S-Term integration installer copies `sterm-agent-status.ts` to Pi's global extension directory. Pi can load it immediately with `/reload`, or it will be discovered the next time Pi starts.

The extension emits OSC 777 terminal sequences only. It does not open a server, listen on a port, or require credentials.
