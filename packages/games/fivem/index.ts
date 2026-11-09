import { dockerImage } from "./install";
import { fivemSettings } from "./settings";

export const fivem = {
  description:
    "A multiplayer modification for Grand Theft Auto V, letting you play on custom roleplay, racing, and game-mode servers.",
  dockerImage,
  enabled: true,
  gamedigId: "fivem",
  howToConnect: [
    "Open FiveM and press F8 to open the console, or use the server browser.",
    "In the console, type `connect {address}` to join directly.",
    "Alternatively, search for your server name in the FiveM server list.",
  ],
  id: "fivem",
  image: "/games/fivem.webp",
  name: "FiveM",
  ports: [
    {
      from: 30_120,
      protocol: "tcp",
      to: 30_120,
    },
    {
      from: 30_120,
      protocol: "udp",
      to: 30_120,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 20,
    memory: 4,
  },
  settings: fivemSettings,
  usesJoinPassword: false,
} as const;
