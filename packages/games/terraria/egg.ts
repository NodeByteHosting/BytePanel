import type { EggDefinition } from "../egg";
import { GB, joinPasswordVariable, variablesFromSettings } from "../egg";
import { terraria } from "./index";
import { dockerImage } from "./install";
import { terrariaSettings } from "./settings";

export const terrariaEgg: EggDefinition = {
  containerUser: "image",
  containerPorts: [0, 0],
  description: terraria.description,
  dockerImages: { Default: dockerImage },
  done: ["Server started"],
  image: terraria.image,
  invocationMode: "args",
  minDiskMb: terraria.requirements.disk * GB,
  minMemoryMb: terraria.requirements.memory * GB,
  mountPath: "/root/.local/share/Terraria/Worlds",
  name: terraria.name,
  nest: "Sandbox",
  slug: "terraria",
  startup: [
    "-port {{SERVER_PORT}}",
    "-autocreate {{WORLD_SIZE}}",
    "-difficulty {{DIFFICULTY}}",
    "-maxplayers {{MAX_PLAYERS}}",
    '-worldname "{{WORLD_NAME}}"',
    '-motd "{{MOTD}}"',
    '-password "{{SERVER_PASSWORD}}"',
  ].join(" "),
  stop: "exit",
  variables: [
    {
      default: "{{server.name}}",
      env: "WORLD_NAME",
      name: "World name",
      rules: "required|string|max:64",
    },
    joinPasswordVariable("SERVER_PASSWORD"),
    ...variablesFromSettings(terrariaSettings, {
      difficulty: "DIFFICULTY",
      maxPlayers: "MAX_PLAYERS",
      motd: "MOTD",
      worldSize: "WORLD_SIZE",
    }),
    {
      default: "bytepanel.wld",
      env: "WORLD_FILENAME",
      name: "World file",
      rules: "required|string|max:64",
      userEditable: false,
    },
  ],
};
