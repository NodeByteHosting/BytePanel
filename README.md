# NodeByte Providers (GSP)

GSP is the provider abstraction layer used by NodeByte GSM to manage cloud infrastructure across multiple hosting vendors.

Core responsibilities:

- Unified interface for server and image operations
- Credential validation and token management
- Catalog fetching and resource discovery
- Server lifecycle management (create, delete, rebuild)
- Image/snapshot operations (create, delete, list)

## Supported Providers

- **Hetzner Cloud** — Primary production provider with full feature support

## Architecture

The provider package exports:

- `Provider` — Main interface for all provider operations
- `CatalogServerType` — Server type metadata (disk, price, cores, locations)
- `ProviderServer` — Unified server representation
- `ProviderImage` — Unified image/snapshot representation
- Error types — `MissingProviderCredentialsError`, `ApiError`

## Requirements

- TypeScript 6.0+
- Node.js 20+ (for type checking and linting)

## Development

```bash
npm install
npm run check
```

Useful scripts:

```bash
npm run types
npm run lint
```

## Integration

Providers are used by:

- `lib/workflows/build-snapshot.ts` — Snapshot creation orchestration
- `app/api/servers/*` — Server management APIs
- `app/api/admin/catalog` — Catalog browsing endpoints

## Adding a New Provider

1. Create a new directory (e.g., `vultr/`)
2. Implement the `Provider` interface
3. Export from `index.ts` via the `buildProvider()` switch
4. Add credential validation and token resolution

## Security

Provider tokens are sensitive and must never be logged. Always use:

- `redactUrl()` when logging Git remotes
- `redactToken()` for any credential logging

Report vulnerabilities privately:

- security@nodebyte.co.uk
