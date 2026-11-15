# BytePanel agent

The agent is the lightweight runtime agent used by BytePanel to manage game servers on host machines.

Core responsibilities:

- Accept signed control-plane commands
- Execute operational tasks safely
- Manage server files and process state
- Report install, backup and activity events back to the panel

## Requirements

- Bun 1.3.13+
- Linux target for compiled binaries

## Development

```bash
bun install
bun run check
bun run build
```

Useful scripts:

```bash
bun run dev
bun run types
```

## Build Output

The build script compiles a Linux x64 binary to:

- `dist/bytepanel-daemon`

## Integration

The agent shares protocol contracts with the panel through the `@bytepanel/protocol` workspace package.

## Security

The agent is security-sensitive. Report vulnerabilities privately:

- security@nodebyte.co.uk

Community support:

- https://discord.gg/nodebyte

## License

AGPL-3.0-only.
