import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { vrisingSettings } from "./settings";

export const vrising = {
  description:
    "Rise as a vampire lord: hunt, build a castle, and battle players in a gothic open world.",
  dockerImage,
  enabled: true,
  gamedigId: "vrising",
  id: "vrising",
  image: steamHeader(1_604_030),
  name: "V Rising",
  ports: [
    {
      from: 9876,
      protocol: "udp",
      to: 9876,
    },
    {
      from: 9877,
      protocol: "udp",
      to: 9877,
    },
  ],
  requirements: {
    cpu: 4,
    disk: 15,
    memory: 8,
  },
  settings: vrisingSettings,
  usesJoinPassword: true,
} as const;
