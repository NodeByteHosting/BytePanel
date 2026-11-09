# BytePanel

BytePanel is the web control plane for provisioning, configuring, and operating dedicated game servers.

It includes:

- Server lifecycle management and provisioning flows
- Billing through BytePay, using the panel's billing API
- Integration with the BytePanel agent

## Architecture

A [Turborepo](https://turbo.build) monorepo using Bun workspaces:

- `apps/web`: The panel, with Next.js App Router pages, API routes and Prisma
- `apps/agent`: The BytePanel agent, which runs on server hosts
- `packages/games`: Game recipes, settings and compose generators
- `packages/protocol`: Schemas and constants shared by the panel and the agent

## Quick Start

Prerequisites:

- Bun 1.3.13+
- Node.js 24+
- PostgreSQL
- Redis
- Any S3-compatible object storage, for avatars

Setup:

```bash
bun install
cp apps/web/.env.example apps/web/.env.local
bun run migrate
bun run dev
```

## Deployment

The root `Dockerfile` builds the panel and runs `prisma migrate deploy` when the container starts. `docker-compose.yml` adds PostgreSQL and Redis:

```bash
cp apps/web/.env.example apps/web/.env
POSTGRES_PASSWORD=change-me docker compose up -d --build
```

Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and the `S3_*` values in `apps/web/.env` first.

Customers sign in through BytePay. Set the `BYTEPAY_*` values to enable it, and create a confidential OAuth client in BytePay with the redirect URI `<BETTER_AUTH_URL>/api/auth/callback/bytepay`.

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
