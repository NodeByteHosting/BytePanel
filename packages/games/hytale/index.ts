import { dockerImage } from "./install";
import { hytaleSettings } from "./settings";

export const hytale = {
  description:
    "Set out on an adventure built for both creation and play. Hytale blends the freedom of a sandbox with the momentum of an RPG.",
  dockerImage,
  enabled: true,
  howToConnect: [
    "Launch the Hytale client and navigate to the Multiplayer menu.",
    'Click "Join Server" and enter the server address shown above.',
    "You may be prompted to authenticate depending on the server's auth mode.",
  ],
  id: "hytale",
  image: "/games/hytale.png",
  name: "Hytale",
  ports: [
    {
      from: 25_565,
      protocol: "tcp" as const,
      to: 25_565,
    },
    {
      from: 25_566,
      protocol: "udp" as const,
      to: 25_566,
    },
  ],
  requirements: {
    cpu: 2,
    disk: 15,
    memory: 4,
  },
  settings: hytaleSettings,
  usesJoinPassword: false,
} as const;
