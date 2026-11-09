import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { cs2Settings } from "./settings";

export const cs2 = {
  description:
    "The legendary tactical FPS. Plant the bomb, defuse it, or just frag your friends.",
  dockerImage,
  enabled: true,
  gamedigId: "cs2",
  howToConnect: [
    "Open Counter-Strike 2 and go to Settings → Game.",
    'Set "Enable Developer Console (~)" to Yes.',
    "Press `~` in-game to open the console.",
    "Run `connect {address}; password <your password>` using the password shown above.",
  ],
  id: "cs2",
  image: steamHeader(730),
  name: "Counter-Strike 2",
  ports: [
    {
      from: 27_015,
      protocol: "udp",
      to: 27_015,
    },
    {
      from: 27_015,
      protocol: "tcp",
      to: 27_015,
    },
    {
      from: 27_020,
      protocol: "udp",
      to: 27_020,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 50,
    memory: 4,
  },
  settings: cs2Settings,
  usesJoinPassword: true,
} as const;
