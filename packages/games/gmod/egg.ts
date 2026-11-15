import type { EggDefinition } from "../egg";
import { GB, hiddenVariable, variablesFromSettings } from "../egg";
import { gmod } from "./index";
import { dockerImage } from "./install";
import { gmodSettings } from "./settings";

export const gmodEgg: EggDefinition = {
  containerUser: "image",
  containerPorts: [0, 0],
  description: gmod.description,
  dockerImages: { Default: dockerImage },
  done: [],
  image: gmod.image,
  invocationMode: "env",
  minDiskMb: gmod.requirements.disk * GB,
  minMemoryMb: gmod.requirements.memory * GB,
  mountPath: "/serverdata/serverfiles",
  name: gmod.name,
  nest: "Source Engine",
  slug: "gmod",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    ...variablesFromSettings(gmodSettings, {
      gamemode: "GAMEMODE",
      luaRefresh: { boolean: ["1", "0"], env: "LUA_REFRESH" },
      map: "MAP",
      maxPlayers: "MAXPLAYERS",
      steamToken: "STEAM_TOKEN",
      tickrate: "TICKRATE",
      workshopId: "WORKSHOPCOLLECTION",
    }),
    hiddenVariable("GAME_PORT", "{{SERVER_PORT}}"),
  ],
  volumeOwner: "99:100",
};
