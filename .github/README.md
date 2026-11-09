# NodeByte Game Server Manager (GSM)

NodeByte GSM is the web control plane for provisioning, configuring, and operating dedicated game servers.

It includes:

- Server lifecycle management and provisioning flows
- Billing and subscription integration
- Third-Party Provider integrations
- Snapshot and automation workflows
- Integration with the NodeByte Game Server Agent (GSA)

## Architecture

A [Turborepo](https://turbo.build) monorepo using Bun workspaces:

- `apps/web`: The panel, with Next.js App Router pages, API routes and Prisma
- `apps/agent`: The NodeByte Game Server Agent (GSA), which runs on server hosts
- `packages/games`: Game recipes, settings and compose generators
- `packages/protocol`: Schemas and constants shared by the panel and the agent

## Quick Start

Prerequisites:

- Bun 1.3.13+
- Node.js 24+
- PostgreSQL

Setup:

```bash
bun install
cp apps/web/.env.example apps/web/.env.local
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
bun run dev:agent
bun run build:agent
```

## Security

Please report vulnerabilities privately. See `SECURITY.md` for disclosure policy.

- Security contact: security@nodebyte.co.uk
- Community support: https://discord.gg/nodebyte

## Contributing

Read `CONTRIBUTING.md` for contribution workflow and quality expectations.

## License

AGPL-3.0-only.
