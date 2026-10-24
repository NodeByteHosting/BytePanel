import type { EggDefinition } from "../egg";
import { GB, hiddenVariable, rconPasswordVariable, serverNameVariable, variablesFromSettings } from "../egg";
import { minecraft } from "./index";
import { dockerImage } from "./install";
import { minecraftSettings } from "./settings";

// itzg-based image: the entrypoint reads everything from env and drops to
// uid 1000. SERVER_PORT is set by the daemon from the primary allocation.
export const minecraftEgg: EggDefinition = {
  containerUser: "image",
  description: minecraft.description,
  dockerImages: { Default: dockerImage },
  done: [")! For help, type "],
  image: minecraft.image,
  invocationMode: "env",
  minDiskMb: minecraft.requirements.disk * GB,
  minMemoryMb: minecraft.requirements.memory * GB,
  mountPath: "/var/lib/nodebyte/game/data",
  name: minecraft.name,
  nest: "Minecraft",
  slug: "minecraft",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("SERVER_NAME"),
    {
      default: "{{server.name}} - Powered by NodeByte",
      env: "MOTD",
      name: "MOTD",
      rules: "nullable|string|max:150",
    },
    ...variablesFromSettings(minecraftSettings, {
      allowNether: "ALLOW_NETHER",
      difficulty: "DIFFICULTY",
      enableCommandBlock: "ENABLE_COMMAND_BLOCK",
      javaVersion: "JAVA_VERSION",
      maxPlayers: "MAX_PLAYERS",
      minecraftVersion: "VERSION",
      mode: "MODE",
      onlineMode: "ONLINE_MODE",
      pvp: "PVP",
      serverType: "TYPE",
      spawnProtection: "SPAWN_PROTECTION",
      viewDistance: "VIEW_DISTANCE",
    }),
    rconPasswordVariable("RCON_PASSWORD"),
    hiddenVariable("EULA", "TRUE"),
    hiddenVariable("ENABLE_RCON", "true"),
    hiddenVariable("OVERRIDE_SERVER_PROPERTIES", "true"),
    // Size the heap from the container limit instead of a fixed value.
    hiddenVariable("MEMORY", ""),
    hiddenVariable("JVM_XX_OPTS", "-XX:MaxRAMPercentage=75"),
    hiddenVariable("UID", "1000"),
    hiddenVariable("GID", "1000"),
  ],
  volumeOwner: "1000:1000",
};
