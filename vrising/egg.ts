import type { EggDefinition } from "../egg";
import {
  GB,
  hiddenVariable,
  joinPasswordVariable,
  rconPasswordVariable,
  serverNameVariable,
  variablesFromSettings,
} from "../egg";
import { vrising } from "./index";
import { dockerImage } from "./install";
import { vrisingSettings } from "./settings";

export const vrisingEgg: EggDefinition = {
  containerUser: "image",
  // game, query
  containerPorts: [0, 0],
  description: vrising.description,
  dockerImages: { Default: dockerImage },
  done: ["Server Startup Complete"],
  extraMounts: [{ source: "server", target: "/mnt/vrising/server" }],
  image: vrising.image,
  invocationMode: "env",
  minDiskMb: vrising.requirements.disk * GB,
  minMemoryMb: vrising.requirements.memory * GB,
  mountPath: "/mnt/vrising/persistentdata",
  name: vrising.name,
  nest: "Survival",
  slug: "vrising",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("SERVERNAME"),
    joinPasswordVariable("HOST_SETTINGS_Password"),
    rconPasswordVariable("HOST_SETTINGS_Rcon__Password"),
    ...variablesFromSettings(vrisingSettings, {
      gameSettingsPreset: "GAME_SETTINGS_Preset",
      maxPlayers: "HOST_SETTINGS_MaxConnectedUsers",
      public: "HOST_SETTINGS_ListOnSteam",
      saveName: "WORLDNAME",
    }),
    hiddenVariable("HOST_SETTINGS_ListOnEOS", "{{HOST_SETTINGS_ListOnSteam}}"),
    hiddenVariable("HOST_SETTINGS_Rcon__Enabled", "true"),
    hiddenVariable("GAMEPORT", "{{SERVER_PORT}}"),
    hiddenVariable("QUERYPORT", "{{SERVER_PORT_1}}"),
  ],
};
