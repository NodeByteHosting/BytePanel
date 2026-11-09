import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { l4d2Settings } from "./settings";

export const l4d2 = {
  description:
    "Co-op zombie apocalypse FPS. Fight your way through hordes of the infected with up to 3 friends.",
  dockerImage,
  enabled: true,
  gamedigId: "left4dead2",
  howToConnect: [
    "Open Left 4 Dead 2 and go to Options → Keyboard/Mouse.",
    'Set "Allow Developer Console" to Enabled.',
    "Press `~` from the main menu to open the console.",
    "Run `connect {address}`.",
  ],
  id: "l4d2",
  image: steamHeader(550),
  name: "Left 4 Dead 2",
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
  ],
  requirements: {
    cpu: 2,
    disk: 15,
    memory: 2,
  },
  settings: l4d2Settings,
  usesJoinPassword: false,
} as const;
