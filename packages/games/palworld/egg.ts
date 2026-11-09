import type { EggDefinition } from "../egg";
import {
  GB,
  hiddenVariable,
  joinPasswordVariable,
  rconPasswordVariable,
  serverNameVariable,
  variablesFromSettings,
} from "../egg";
import { palworld } from "./index";
import { dockerImage } from "./install";
import { palworldSettings } from "./settings";

export const palworldEgg: EggDefinition = {
  containerUser: "image",
  containerPorts: [0, 0, 0],
  description: palworld.description,
  dockerImages: { Default: dockerImage },
  done: ["Running Palworld dedicated server"],
  image: palworld.image,
  invocationMode: "env",
  minDiskMb: palworld.requirements.disk * GB,
  minMemoryMb: palworld.requirements.memory * GB,
  mountPath: "/palworld",
  name: palworld.name,
  nest: "Survival",
  slug: "palworld",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("SERVER_NAME"),
    joinPasswordVariable("SERVER_PASSWORD"),
    rconPasswordVariable("ADMIN_PASSWORD", "Admin password"),
    ...variablesFromSettings(palworldSettings, {
      description: "SERVER_DESCRIPTION",
      difficulty: "DIFFICULTY",
      maxPlayers: "PLAYERS",
      multithreading: "MULTITHREADING",
      pvp: "PVP",
    }),
    hiddenVariable("PUID", "1000"),
    hiddenVariable("PGID", "1000"),
    hiddenVariable("PORT", "{{SERVER_PORT}}"),
    hiddenVariable("QUERY_PORT", "{{SERVER_PORT_1}}"),
    hiddenVariable("RCON_PORT", "{{SERVER_PORT_2}}"),
    hiddenVariable("RCON_ENABLED", "true"),
    hiddenVariable("COMMUNITY", "true"),
  ],
  volumeOwner: "1000:1000",
};
