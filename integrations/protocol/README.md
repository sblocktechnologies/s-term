# S-Term agent protocol

S-Term listens for OSC 777 sequences written to the terminal attached to an agent.

## Status messages

```text
ESC ] 777 ; sterm;v=1;state=<state>;agent=<agent>;message=<encoded-message> BEL
```

Fields are separated by semicolons. Values use percent encoding. `message` is optional.

Supported states:

- `idle`
- `working`
- `attention`
- `complete`
- `error`

Example:

```sh
printf '\033]777;sterm;v=1;state=complete;agent=generic;message=Task%%20finished\007' > /dev/tty
```

## Telemetry messages

Pi uses a separate message type for pane-header metadata. Telemetry does not change agent lifecycle, unread, elapsed-time, or notification state.

```text
ESC ] 777 ; sterm;v=1;event=telemetry;agent=pi;cwd=...;branch=...;dirty=1;input=12000;output=3400;model=... BEL
```

Supported optional fields are:

- `cwd`
- `branch`
- `dirty`
- `provider`
- `model`
- `thinking`
- `input`
- `output`
- `cacheRead`
- `cacheWrite`
- `cost`
- `sub`
- `contextTokens`
- `contextWindow`
- `contextPercent`

No credentials, account identifiers, or authentication tokens are transmitted.

OSC 777 sequences are consumed by S-Term and are not displayed. Other terminal emulators should safely ignore an unknown OSC identifier.
