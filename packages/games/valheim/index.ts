import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { valheimSettings } from "./settings";

export const valheim = {
  description:
    "A Viking-themed action RPG where you explore, craft, build, and survive.",
  dockerImage,
  enabled: true,
  gamedigId: "valheim",
  id: "valheim",
  image: steamHeader(892_970),
  name: "Valheim",
  ports: [
    {
      from: 2456,
      protocol: "udp",
      to: 2458,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 10,
    memory: 6,
  },
  settings: valheimSettings,
  usesJoinPassword: true,
} as const;
