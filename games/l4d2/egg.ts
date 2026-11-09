import type { EggDefinition } from "../egg";
import { GB, hiddenVariable, rconPasswordVariable, serverNameVariable, variablesFromSettings } from "../egg";
import { l4d2 } from "./index";
import { dockerImage } from "./install";
import { l4d2Settings } from "./settings";

// The image symlinks /cfg into left4dead2/cfg, so the volume holds the server
// config. Cvars that must survive map changes live in server.cfg (written by
// the install script, kept in sync by the config-file parser).
export const l4d2Egg: EggDefinition = {
  configFiles: [
    {
      file: "server.cfg",
      parser: "file",
      replace: [{ match: "z_difficulty", value: "z_difficulty {{DIFFICULTY}}" }],
    },
  ],
  containerUser: "image",
  description: l4d2.description,
  dockerImages: { Default: dockerImage },
  done: [],
  image: l4d2.image,
  install: {
    container: "alpine:3",
    entrypoint: "sh",
    script: [
      "#!/bin/sh",
      "set -e",
      "cd /mnt/server",
      "if [ ! -f server.cfg ]; then",
      '  printf "z_difficulty normal\\nsv_allow_lobby_connect_only 0\\n" > server.cfg',
      "fi",
      "echo 'server.cfg ready'",
    ].join("\n"),
  },
  invocationMode: "env",
  minDiskMb: l4d2.requirements.disk * GB,
  minMemoryMb: l4d2.requirements.memory * GB,
  mountPath: "/cfg",
  name: l4d2.name,
  nest: "Source Engine",
  slug: "l4d2",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("HOSTNAME"),
    rconPasswordVariable("RCON_PASSWORD"),
    ...variablesFromSettings(l4d2Settings, {
      difficulty: "DIFFICULTY",
      gameMode: "DEFAULT_MODE",
      maxPlayers: "MAX_PLAYERS",
      startMap: "DEFAULT_MAP",
      steamToken: "STEAM_TOKEN",
    }),
    hiddenVariable("PORT", "{{SERVER_PORT}}"),
    // Boot-time cvars (before the Steam connection is established).
    hiddenVariable("EXTRA_ARGS", '+maxplayers {{MAX_PLAYERS}} +sv_setsteamaccount "{{STEAM_TOKEN}}"'),
  ],
};
