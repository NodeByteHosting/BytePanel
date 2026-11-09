import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { rustSettings } from "./settings";

export const rust = {
  description:
    "The only aim in Rust is to survive when everything on the island wants you to die.",
  dockerImage,
  enabled: true,
  gamedigId: "rust",
  howToConnect: [
    'Launch Rust and click "Play Game" to load into the main menu.',
    "Press `F1` to open the console.",
    "Run `client.connect {address}` and press Enter.",
  ],
  id: "rust",
  image: steamHeader(252_490),
  name: "Rust",
  ports: [
    {
      from: 28_015,
      protocol: "udp",
      to: 28_015,
    },
    {
      from: 28_016,
      protocol: "tcp",
      to: 28_016,
    },
    {
      from: 28_017,
      protocol: "udp",
      to: 28_017,
    },
  ],
  requirements: {
    cpu: 4,
    disk: 30,
    memory: 8,
  },
  settings: rustSettings,
  usesJoinPassword: false,
} as const;
