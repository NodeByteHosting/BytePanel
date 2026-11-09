import type { EggDefinition } from "../egg";
import { GB, variablesFromSettings } from "../egg";
import { hytale } from "./index";
import { dockerImage } from "./install";
import { hytaleSettings } from "./settings";

// Optional CLI flags use the Pterodactyl shell idiom so booleans can toggle them.
const flag = (variable: string, value: string) =>
  `$( [ "{{${variable}}}" = "1" ] && printf %s "${value}" )`;

export const hytaleEgg: EggDefinition = {
  containerUser: "image",
  // game (tcp+udp) and query
  containerPorts: [0, 0],
  description: hytale.description,
  dockerImages: { Default: dockerImage },
  done: [],
  image: hytale.image,
  invocationMode: "shell",
  minDiskMb: hytale.requirements.disk * GB,
  minMemoryMb: hytale.requirements.memory * GB,
  mountPath: "/mnt/server",
  name: hytale.name,
  nest: "Sandbox",
  slug: "hytale",
  startup: [
    "java",
    flag("USE_AOT_CACHE", "-XX:AOTCache=Server/HytaleServer.aot"),
    "-Xms128M -Xmx{{MAX_MEMORY_MB}}M",
    "-jar Server/HytaleServer.jar",
    flag("ALLOW_OP", "--allow-op"),
    flag("ACCEPT_EARLY_PLUGINS", "--accept-early-plugins"),
    flag("DISABLE_SENTRY", "--disable-sentry"),
    "--auth-mode {{AUTH_MODE}}",
    "--assets Assets.zip",
    "--bind 0.0.0.0:{{SERVER_PORT}}",
  ].join(" "),
  stop: "^SIGTERM",
  variables: variablesFromSettings(hytaleSettings, {
    acceptEarlyPlugins: { boolean: ["1", "0"], env: "ACCEPT_EARLY_PLUGINS" },
    allowOp: { boolean: ["1", "0"], env: "ALLOW_OP" },
    authMode: "AUTH_MODE",
    disableSentry: { boolean: ["1", "0"], env: "DISABLE_SENTRY" },
    maxMemoryMb: "MAX_MEMORY_MB",
    patchline: "HYTALE_PATCHLINE",
    useAotCache: { boolean: ["1", "0"], env: "USE_AOT_CACHE" },
  }),
};
