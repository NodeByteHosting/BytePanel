import type { EggDefinition } from "../egg";
import { GB, hiddenVariable, joinPasswordVariable, serverNameVariable, variablesFromSettings } from "../egg";
import { valheim } from "./index";
import { dockerImage } from "./install";
import { valheimSettings } from "./settings";

// lloesche/valheim-server listens on SERVER_PORT and SERVER_PORT+1 (query),
// so the two allocations must be consecutive (the panel prefers that).
export const valheimEgg: EggDefinition = {
  containerUser: "image",
  containerPorts: [0, 0],
  description: valheim.description,
  dockerImages: { Default: dockerImage },
  done: ["Game server connected"],
  extraMounts: [{ source: "server", target: "/opt/valheim" }],
  image: valheim.image,
  invocationMode: "env",
  minDiskMb: valheim.requirements.disk * GB,
  minMemoryMb: valheim.requirements.memory * GB,
  mountPath: "/config",
  name: valheim.name,
  nest: "Survival",
  slug: "valheim",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("SERVER_NAME"),
    {
      ...joinPasswordVariable("SERVER_PASS"),
      default: "@random",
      description: "Valheim requires a password of at least 5 characters.",
      rules: "required|string|min:5|max:64",
    },
    ...variablesFromSettings(valheimSettings, {
      public: "SERVER_PUBLIC",
      worldName: "WORLD_NAME",
    }),
    {
      default: "-crossplay",
      description: "Extra server arguments. Remove -crossplay to disable crossplay.",
      env: "SERVER_ARGS",
      name: "Server arguments",
      rules: "nullable|string|max:256",
    },
    hiddenVariable("BACKUPS_DIRECTORY", "/config/backups"),
  ],
};
