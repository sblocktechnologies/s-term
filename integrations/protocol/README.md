# S-Term agent status protocol

S-Term listens for OSC 777 sequences written to the terminal attached to an agent.

## Format

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

The sequence is consumed by S-Term and is not displayed. Other terminal emulators should safely ignore an unknown OSC identifier.
