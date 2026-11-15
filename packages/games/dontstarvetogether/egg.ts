import type { EggDefinition } from "../egg";
import {
  GB,
  hiddenVariable,
  joinPasswordVariable,
  serverNameVariable,
  variablesFromSettings,
} from "../egg";
import { dontStarveTogether } from "./index";
import { dockerImage } from "./install";
import { dontStarveTogetherSettings } from "./settings";

export const dontStarveTogetherEgg: EggDefinition = {
  containerUser: "image",
  containerPorts: [0, 27_017, 8767],
  description: dontStarveTogether.description,
  dockerImages: { Default: dockerImage },
  done: ["Sim paused"],
  image: dontStarveTogether.image,
  invocationMode: "env",
  minDiskMb: dontStarveTogether.requirements.disk * GB,
  minMemoryMb: dontStarveTogether.requirements.memory * GB,
  mountPath: "/var/lib/game",
  name: dontStarveTogether.name,
  nest: "Survival",
  slug: "dontstarvetogether",
  startup: "",
  stop: "c_shutdown()",
  variables: [
    serverNameVariable("DST_NETWORK_CLUSTER_NAME"),
    {
      default: "Powered by BytePanel",
      env: "DST_NETWORK_CLUSTER_DESCRIPTION",
      name: "Description",
      rules: "nullable|string|max:256",
    },
    joinPasswordVariable("DST_NETWORK_CLUSTER_PASSWORD"),
    ...variablesFromSettings(dontStarveTogetherSettings, {
      clusterToken: "DST_CLUSTER_TOKEN",
      gameMode: "DST_GAMEPLAY_GAME_MODE",
      intention: "DST_NETWORK_CLUSTER_INTENTION",
      maxPlayers: "DST_GAMEPLAY_MAX_PLAYERS",
      pvp: "DST_GAMEPLAY_PVP",
    }),
    hiddenVariable("DST_NETWORK_SERVER_PORT", "{{SERVER_PORT}}"),
    hiddenVariable("DST_GAMEPLAY_PAUSE_WHEN_EMPTY", "true"),
    hiddenVariable("DST_MISC_CONSOLE_ENABLED", "true"),
    hiddenVariable("DST_SHARD_IS_MASTER", "true"),
    hiddenVariable("DST_SHARD_ENABLED", "false"),
  ],
};
