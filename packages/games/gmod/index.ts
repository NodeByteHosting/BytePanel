import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { gmodSettings } from "./settings";

export const gmod = {
  description:
    "The ultimate sandbox game. Build contraptions, play custom gamemodes, or just mess around with the physics engine.",
  dockerImage,
  enabled: true,
  gamedigId: "garrysmod",
  howToConnect: [
    "Open Garry's Mod and go to the Multiplayer menu.",
    'Click "Legacy Browser" or use the console command `connect {address}`.',
    "If a password is set, enter it when prompted.",
  ],
  id: "gmod",
  image: steamHeader(4000),
  name: "Garry's Mod",
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
      from: 27_005,
      protocol: "udp",
      to: 27_005,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 15,
    memory: 2,
  },
  settings: gmodSettings,
  usesJoinPassword: true,
} as const;
