# Security Policy

## Supported Versions

| Version | New Features | Bug Fixes | Security Fixes |
| -------- | ------- | ------- | ------- |
| v1.0.x (Beta) | ✅ | ✅ | ✅ | 


Security fixes are prioritized for active development branches:

- `master`
- `main`

Older, unmaintained branches may not receive patches.

## Reporting a Vulnerability

Do not open public issues for security vulnerabilities.

Please report privately to:

- security@nodebyte.co.uk

Include as much detail as possible:

- Affected component(s)
- Reproduction steps or proof-of-concept
- Impact and likely attack scenario
- Suggested mitigations (if any)

Optional real-time coordination:

- https://discord.gg/nodebyte

If sharing sensitive details, email is preferred.

## Disclosure Process

1. We acknowledge reports as quickly as possible.
2. We triage severity and reproduce the issue.
3. We implement and verify a fix.
4. We coordinate disclosure timing with the reporter when appropriate.
5. We publish a patch and advisory notes.

## Scope Notes

For GSM/GSA specifically, security-sensitive areas include:

- Authentication and session handling
- API authorization and role checks
- Stripe webhook verification and idempotency
- Agent command execution and filesystem operations
- Key management and request signing

## Hardening Guidelines for Contributors

- Never commit secrets, tokens, or production keys.
- Validate external input before persistence or command execution.
- Keep dependencies updated and avoid unmaintained packages.
- Prefer least privilege for database and infrastructure credentials.
