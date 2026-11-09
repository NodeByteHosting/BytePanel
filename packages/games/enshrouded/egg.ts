import type { EggDefinition } from "../egg";
import {
  GB,
  hiddenVariable,
  joinPasswordVariable,
  serverNameVariable,
  variablesFromSettings,
} from "../egg";
import { enshrouded } from "./index";
import { dockerImage } from "./install";
import { enshroudedSettings } from "./settings";

export const enshroudedEgg: EggDefinition = {
  containerUser: "image",
  description: enshrouded.description,
  dockerImages: { Default: dockerImage },
  done: [],
  image: enshrouded.image,
  invocationMode: "env",
  minDiskMb: enshrouded.requirements.disk * GB,
  minMemoryMb: enshrouded.requirements.memory * GB,
  mountPath: "/opt/enshrouded",
  name: enshrouded.name,
  nest: "Survival",
  slug: "enshrouded",
  startup: "",
  stop: "^SIGTERM",
  variables: [
    serverNameVariable("SERVER_NAME"),
    joinPasswordVariable("SERVER_ROLE_0_PASSWORD"),
    ...variablesFromSettings(enshroudedSettings, {
      slots: "SERVER_SLOT_COUNT",
      voiceChat: "SERVER_ENABLE_VOICE_CHAT",
    }),
    hiddenVariable("SERVER_QUERYPORT", "{{SERVER_PORT}}"),
    hiddenVariable("SERVER_VOICE_CHAT_MODE", "Proximity"),
    hiddenVariable("SERVER_ROLE_0_NAME", "Players"),
    hiddenVariable("SERVER_ROLE_0_CAN_ACCESS_INVENTORIES", "true"),
    hiddenVariable("SERVER_ROLE_0_CAN_EDIT_BASE", "true"),
    hiddenVariable("SERVER_ROLE_0_CAN_EXTEND_BASE", "true"),
    hiddenVariable("SERVER_ROLE_0_CAN_EDIT_WORLD", "true"),
    hiddenVariable("UPDATE_CRON", "*/30 * * * *"),
    hiddenVariable("PUID", "4711"),
    hiddenVariable("PGID", "4711"),
  ],
  volumeOwner: "4711:4711",
};
