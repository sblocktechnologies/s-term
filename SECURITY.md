# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository.

Include:

- A description of the issue
- Reproduction steps
- Affected operating systems
- Potential impact
- Any suggested mitigation

Please avoid including terminal contents, credentials, agent configuration, or private session data unless necessary for reproduction.

## Security model

S-Term launches local shells and optional AI agent integrations with the current user's permissions. Install integrations only from a trusted S-Term build. External links are restricted to HTTP and HTTPS before being passed to the operating system.
