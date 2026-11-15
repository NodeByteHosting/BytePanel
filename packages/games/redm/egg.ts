import type { EggDefinition } from "../egg";
import { GB } from "../egg";
import { redm } from "./index";
import { dockerImage } from "./install";
import recipe from "./recipe.json";

export const redmEgg: EggDefinition = {
  configFiles: recipe.configFiles as EggDefinition["configFiles"],
  containerUser: "daemon",
  containerPorts: [0, 0],
  description: redm.description,
  dockerImages: { Default: dockerImage },
  done: ["succeeded. Welcome!"],
  image: redm.image,
  install: recipe.install,
  invocationMode: "env",
  minDiskMb: redm.requirements.disk * GB,
  minMemoryMb: redm.requirements.memory * GB,
  mountPath: "/home/container",
  name: redm.name,
  nest: "Cfx.re",
  slug: "redm",
  startup: "",
  stop: "^SIGTERM",
  variables: recipe.variables,
};
