# Contributing to NodeByte GSM

Thanks for contributing to NodeByte Game Server Manager (GSM). This repository contains the web control plane plus shared platform logic for managing dedicated game servers.

## Ways to contribute

- Report bugs with clear reproduction steps and expected behavior.
- Request support for new games and server templates.
- Submit fixes and features via pull requests.
- Report vulnerabilities privately using the process in the root SECURITY.md.

## Development setup

Prerequisites:

- Bun 1.3.13+
- Node.js 24+
- PostgreSQL

Setup:

```bash
bun install
cp apps/web/.env.example apps/web/.env.local
bun migrate
bun dev
```

## Project checks

Before opening a PR, run:

```bash
bun run check
bun run types
bun run test
```

## Pull request guidelines

- Keep PRs focused and scoped to one concern.
- Add tests for behavior changes when feasible.
- Avoid committing secrets, tokens, and local env files.
- Include screenshots or recordings for UI changes.
- Call out schema, migration, and billing changes explicitly in the PR description.

## Commit guidance

Use clear, descriptive commit messages. Conventional commits are encouraged but not required.

## Contact and support

- Maintainer contact: oss@nodebyte.co.uk
- Community Discord: https://discord.gg/nodebyte
- Security reports: security@nodebyte.co.uk

## License

By contributing, you agree your contributions are licensed under AGPL-3.0-only.
