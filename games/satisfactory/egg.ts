import type { EggDefinition } from "../egg";
import { GB, hiddenVariable, variablesFromSettings } from "../egg";
import { satisfactory } from "./index";
import { dockerImage } from "./install";
import { satisfactorySettings } from "./settings";

export const satisfactoryEgg: EggDefinition = {
  containerUser: "image",
  // game (tcp+udp), messaging (tcp)
  containerPorts: [0, 0],
  description: satisfactory.description,
  dockerImages: { Default: dockerImage },
  done: ["Created socket for bind address"],
  image: satisfactory.image,
  invocationMode: "env",
  minDiskMb: satisfactory.requirements.disk * GB,
  minMemoryMb: satisfactory.requirements.memory * GB,
  mountPath: "/config",
  name: satisfactory.name,
  nest: "Survival",
  slug: "satisfactory",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    ...variablesFromSettings(satisfactorySettings, {
      autoPause: "AUTOPAUSE",
      autoSaveInterval: "AUTOSAVEINTERVAL",
      autoSaveOnDisconnect: "AUTOSAVEONDISCONNECT",
      disableSeasonalEvents: "DISABLESEASONALEVENTS",
      maxPlayers: "MAXPLAYERS",
    }),
    hiddenVariable("PUID", "1000"),
    hiddenVariable("PGID", "1000"),
    hiddenVariable("SERVERGAMEPORT", "{{SERVER_PORT}}"),
    hiddenVariable("SERVERMESSAGINGPORT", "{{SERVER_PORT_1}}"),
    hiddenVariable("SERVERIP", "0.0.0.0"),
    hiddenVariable("MULTIHOME", "0.0.0.0"),
    hiddenVariable("SKIPUPDATE", "false"),
    hiddenVariable("STEAMBETA", "false"),
  ],
  volumeOwner: "1000:1000",
};
