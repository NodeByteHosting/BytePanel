import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { palworldSettings } from "./settings";

export const palworld = {
  description:
    'Fight, farm, build and work alongside mysterious creatures called "Pals".',
  dockerImage,
  enabled: true,
  gamedigId: "palworld",
  id: "palworld",
  image: steamHeader(1_623_730),
  name: "Palworld",
  ports: [
    {
      from: 8211,
      protocol: "udp",
      to: 8211,
    },
    {
      from: 27_015,
      protocol: "udp",
      to: 27_015,
    },
    {
      from: 25_575,
      protocol: "tcp",
      to: 25_575,
    },
  ],
  requirements: {
    cpu: 4,
    disk: 15,
    memory: 16,
  },
  settings: palworldSettings,
  usesJoinPassword: true,
} as const;
