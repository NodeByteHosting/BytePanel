# NodeByte Game Server Manager (GSM)

NodeByte GSM is the web control plane for provisioning, configuring, and operating dedicated game servers.

It includes:

- Server lifecycle management and provisioning flows
- Billing and subscription integration
- Third-Party Provider integrations
- Snapshot and automation workflows
- Integration with the NodeByte Game Server Agent (GSA)

## Architecture

- `app/`: Next.js App Router pages and API routes
- `lib/`: Shared business logic, integrations, and provider abstractions
- `protocol/`: Shared schemas and signing contracts used by GSM and GSA
- `games/`: Game-specific settings and compose generators
- `agent/`: GSA submodule (runtime agent for server hosts)

## Quick Start

Prerequisites:

- Bun 1.3.13+
- Node.js 24+
- PostgreSQL

Setup:

```bash
bun install
cp .env.example .env.local
bun run migrate
bun run dev
```

## Development Commands

```bash
bun run check      # lint + formatting checks
bun run types      # type checks
bun run test       # test suite
bun run build      # production build
```

Agent-related:

```bash
bun run agent:dev
bun run agent:build
```

## Submodules

This repository uses submodules for independently versioned components.

```bash
git submodule update --init --recursive
```

If submodule pointers change in a PR, ensure those pointer updates are committed.

### Submodule Push Order

When you edit code inside a submodule, push in this order:

1. Commit and push inside each changed submodule repo first.
2. Return to the parent GSM repo.
3. Commit the updated submodule pointers.
4. Push the parent repo.

Example:

```bash
# 1) Push submodule commits first
cd games
git add -A
git commit -m "your games change"
git push origin main

cd ../lib/providers
git add -A
git commit -m "your providers change"
git push origin main

# 2) Then update parent pointers
cd ../..
git add games lib/providers
git commit -m "chore: bump submodule pointers"
git push origin main
```

### Notes

- If parent status shows `m games` or `m lib/providers`, that means the submodule working tree has local changes.
- If a submodule is in detached HEAD, switch back to `main` before normal pushes:

```bash
cd games
git switch main
```

- CI for private submodules requires a token in workflow env (`GIT_AUTH_TOKEN`, fallbacks supported: `SUBMODULES_TOKEN`, `GITHUB_TOKEN`).

## Security

Please report vulnerabilities privately. See `SECURITY.md` for disclosure policy.

- Security contact: security@nodebyte.co.uk
- Community support: https://discord.gg/nodebyte

## Contributing

Read `CONTRIBUTING.md` for contribution workflow and quality expectations.

## License

AGPL-3.0-only.
