# NodeByte Game Server Agent (GSA)

GSA is the lightweight runtime agent used by NodeByte GSM to manage game servers on host machines.

Core responsibilities:

- Accept signed control-plane commands
- Execute operational tasks safely
- Manage server files and process state
- Emit events/heartbeats back to GSM

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
bun run lint
```

## Build Output

The build script compiles a Linux x64 binary to:

- `dist/nodebyte-daemon`

## Integration

GSA shares protocol contracts with the panel through the `@nodebyte/protocol` workspace package.

## Security

GSA is security-sensitive. Report vulnerabilities privately:

- security@nodebyte.co.uk

Community support:

- https://discord.gg/nodebyte

## License

AGPL-3.0-only.
