import type { EggDefinition } from "../egg";
import { GB } from "../egg";
import { fivem } from "./index";
import { dockerImage } from "./install";
import recipe from "./recipe.json";

export const fivemEgg: EggDefinition = {
  configFiles: recipe.configFiles as EggDefinition["configFiles"],
  containerUser: "daemon",
  containerPorts: [0, 0],
  description: fivem.description,
  dockerImages: { Default: dockerImage },
  done: ["succeeded. Welcome!"],
  image: fivem.image,
  install: recipe.install,
  invocationMode: "env",
  minDiskMb: fivem.requirements.disk * GB,
  minMemoryMb: fivem.requirements.memory * GB,
  mountPath: "/home/container",
  name: fivem.name,
  nest: "Cfx.re",
  slug: "fivem",
  startup: "",
  stop: "^SIGTERM",
  variables: recipe.variables,
};
