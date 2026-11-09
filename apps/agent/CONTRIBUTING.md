# Contributing to NodeByte GSA

Thanks for contributing to NodeByte Game Server Agent (GSA).

## Local Setup

```bash
bun install
bun run check
bun run build
```

## Development Commands

```bash
bun run dev
bun run lint
bun run types
bun run build
```

## Contribution Rules

- Keep changes minimal and focused.
- Add tests when introducing behavior changes.
- Treat all command/file operations as security-sensitive.
- Avoid breaking shared protocol contracts.

## Pull Request Checklist

- Lint passes (`bun run lint`)
- Type checks pass (`bun run types`)
- Build passes (`bun run build`)
- Security impact reviewed for command or file handling changes

## Help and Contact

- Maintainer contact: oss@nodebyte.co.uk
- Community support: https://discord.gg/nodebyte
- Security reports: security@nodebyte.co.uk

## License

By contributing, you agree your contributions are licensed under AGPL-3.0-only.
