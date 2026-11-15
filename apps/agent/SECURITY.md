# Security Policy for The agent

BytePanel agent executes privileged operations and should be treated as a security-critical component.

## Report Vulnerabilities

Do not disclose vulnerabilities publicly before a fix is available.

Report privately to:

- security@nodebyte.co.uk

Optional coordination channel:

- https://discord.gg/nodebyte

For sensitive material, email is preferred.

## What to Include

- Agent version/commit
- Host OS and runtime details
- Reproduction steps
- Proof-of-concept or logs
- Expected impact and privilege level required

## Priority Areas

- Command validation and authorization
- Signature verification and replay resistance
- Filesystem access boundaries
- Process execution and shell injection risks
- Secret handling and key storage

## Response Process

1. Acknowledge report and triage.
2. Reproduce and assess severity.
3. Develop and validate patch.
4. Coordinate disclosure timeline.
5. Publish fix guidance.
