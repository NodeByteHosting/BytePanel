import type { EggDefinition } from "../egg";
import { GB } from "../egg";
import { cfxConfigFiles, cfxInstallScript, cfxStartup, cfxVariables } from "../fivem/egg";
import { redm } from "./index";
import { dockerImage } from "./install";

export const redmEgg: EggDefinition = {
  configFiles: cfxConfigFiles,
  containerUser: "daemon",
  containerPorts: [0, 0],
  description: redm.description,
  dockerImages: { Default: dockerImage },
  done: ["succeeded. Welcome!"],
  image: redm.image,
  install: {
    container: "ghcr.io/ptero-eggs/installers:alpine",
    entrypoint: "bash",
    script: cfxInstallScript("rdr3"),
  },
  invocationMode: "env",
  minDiskMb: redm.requirements.disk * GB,
  minMemoryMb: redm.requirements.memory * GB,
  mountPath: "/home/container",
  name: redm.name,
  nest: "Cfx.re",
  slug: "redm",
  startup: cfxStartup("CFX_LICENSE"),
  stop: "quit",
  variables: cfxVariables({
    defaultVersion: "latest",
    licenseName: "Cfx.re license key",
    licenseVar: "CFX_LICENSE",
    maxPlayers: 32,
  }),
};
