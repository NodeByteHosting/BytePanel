# BytePanel Game Recipes

Definitions for the games BytePanel can install. The panel syncs these into its eggs from **Admin > Nests**. The Docker images come from the separate [Recipes repo](https://github.com/NodeByteHosting/Recipes).

## Structure

```text
<game>/
  index.ts      Catalog entry: name, description, image, ports, requirements, settings
  settings.ts   Settings customers can edit, built with defineSettings
  install.ts    The dockerImage the server runs
  egg.ts        Egg definition: startup, variables, install script and ready check
```

- `index.ts` exports `games` and `eggs`, plus helpers for reading settings.
- `egg.ts` holds the shared `EggDefinition` type.
- `settings.ts` holds the settings schema and validation helpers.
- `steam.ts` builds Steam header image URLs.

## Commands

```bash
bun run types
bun run validate
```

## Adding a game

1. Copy an existing game directory that works in a similar way.
2. Update `index.ts`, `settings.ts`, `install.ts` and `egg.ts`.
3. Add the game and its egg to the `games` and `eggs` arrays in the root `index.ts`.
4. Run `bun run types` and `bun run validate`, then sync the eggs from the admin panel.

Game images can use any registry. Prefer images from the Recipes repo where one exists, published to `ghcr.io/nodebytehosting/*`.

## Questions?

- Community: https://discord.gg/nodebyte
- Maintainer: oss@nodebyte.co.uk
