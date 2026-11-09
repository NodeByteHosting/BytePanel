import type { EggDefinition } from "../egg";
import {
  GB,
  hiddenVariable,
  joinPasswordVariable,
  rconPasswordVariable,
  serverNameVariable,
  variablesFromSettings,
} from "../egg";
import { cs2 } from "./index";
import { dockerImage } from "./install";
import { cs2Settings } from "./settings";

export const cs2Egg: EggDefinition = {
  containerUser: "image",
  // Allocation 0 = game (tcp+udp), allocation 1 = CSTV.
  containerPorts: [0, 0],
  description: cs2.description,
  dockerImages: { Default: dockerImage },
  done: [],
  image: cs2.image,
  invocationMode: "env",
  minDiskMb: cs2.requirements.disk * GB,
  minMemoryMb: cs2.requirements.memory * GB,
  mountPath: "/home/steam/cs2-dedicated",
  name: cs2.name,
  nest: "Source Engine",
  slug: "cs2",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("CS2_SERVERNAME"),
    joinPasswordVariable("CS2_PW"),
    rconPasswordVariable("CS2_RCONPW"),
    ...variablesFromSettings(cs2Settings, {
      botDifficulty: "CS2_BOT_DIFFICULTY",
      botQuota: "CS2_BOT_QUOTA",
      gameAlias: "CS2_GAMEALIAS",
      lan: { boolean: ["1", "0"], env: "CS2_LAN" },
      maxPlayers: "CS2_MAXPLAYERS",
      startMap: "CS2_STARTMAP",
      steamToken: "SRCDS_TOKEN",
    }),
    hiddenVariable("CS2_PORT", "{{SERVER_PORT}}"),
    hiddenVariable("CS2_RCON_PORT", "{{SERVER_PORT}}"),
    hiddenVariable("TV_PORT", "{{SERVER_PORT_1}}"),
    hiddenVariable("TV_AUTORECORD", "0"),
  ],
  volumeOwner: "1000:1000",
};
