import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { enshroudedSettings } from "./settings";

export const enshrouded = {
  description:
    "A game of survival, crafting, and action on a sprawling voxel-based continent.",
  dockerImage,
  enabled: true,
  gamedigId: "enshrouded",
  id: "enshrouded",
  image: steamHeader(1_203_620),
  name: "Enshrouded",
  ports: [
    {
      from: 15_637,
      protocol: "udp",
      to: 15_637,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 20,
    memory: 4,
  },
  settings: enshroudedSettings,
  usesJoinPassword: true,
} as const;
