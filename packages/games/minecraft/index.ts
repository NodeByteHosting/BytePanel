import { dockerImage } from "./install";
import { minecraftSettings } from "./settings";

export const minecraft = {
  description:
    "Minecraft is a sandbox game where you can build your own world.",
  dockerImage,
  enabled: true,
  gamedigId: "minecraft",
  id: "minecraft",
  image: "/games/minecraft.png",
  name: "Minecraft",
  ports: [
    {
      from: 25_565,
      protocol: "tcp",
      to: 25_565,
    },
    {
      from: 19_132,
      protocol: "udp",
      to: 19_133,
    },
  ],
  requirements: {
    cpu: 1,
    disk: 10,
    memory: 2,
  },
  settings: minecraftSettings,
  usesJoinPassword: false,
} as const;
