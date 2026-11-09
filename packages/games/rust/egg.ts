import type { EggDefinition } from "../egg";
import { GB, rconPasswordVariable, serverNameVariable, variablesFromSettings } from "../egg";
import { rust } from "./index";
import { dockerImage } from "./install";
import { rustSettings } from "./settings";

// The image's entrypoint is RustDedicated itself, so the startup line is
// passed as its arguments.
export const rustEgg: EggDefinition = {
  containerUser: "image",
  // game (udp), rcon (tcp), query (udp)
  containerPorts: [0, 0, 0],
  description: rust.description,
  dockerImages: { Default: dockerImage },
  done: ["Server startup complete"],
  image: rust.image,
  invocationMode: "args",
  minDiskMb: rust.requirements.disk * GB,
  minMemoryMb: rust.requirements.memory * GB,
  mountPath: "/srv/rust/server/nodebyte",
  name: rust.name,
  nest: "Survival",
  slug: "rust",
  startup: [
    "+server.ip 0.0.0.0",
    "+server.port {{SERVER_PORT}}",
    '+server.hostname "{{HOSTNAME}}"',
    '+server.description "{{DESCRIPTION}}"',
    "+server.maxplayers {{MAX_PLAYERS}}",
    "+server.worldsize {{WORLD_SIZE}}",
    "+server.seed {{SEED}}",
    "+server.queryport {{SERVER_PORT_2}}",
    "+rcon.ip 0.0.0.0",
    "+rcon.port {{SERVER_PORT_1}}",
    '+rcon.password "{{RCON_PASSWORD}}"',
    "+rcon.web {{RCON_WEB}}",
    "+server.identity nodebyte",
  ].join(" "),
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("HOSTNAME"),
    rconPasswordVariable("RCON_PASSWORD"),
    ...variablesFromSettings(rustSettings, {
      description: "DESCRIPTION",
      maxPlayers: "MAX_PLAYERS",
      rconWeb: { boolean: ["1", "0"], env: "RCON_WEB" },
      seed: "SEED",
      worldSize: "WORLD_SIZE",
    }),
  ],
  volumeOwner: "10001:10001",
};
