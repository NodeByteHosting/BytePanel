import { steamHeader } from "../steam";
import { dockerImage } from "./install";
import { terrariaSettings } from "./settings";

export const terraria = {
  description:
    "Dig, fight, explore, build! Nothing is impossible in this 2D adventure game.",
  dockerImage,
  enabled: true,
  gamedigId: "terrariatshock",
  id: "terraria",
  image: steamHeader(105_600),
  name: "Terraria",
  ports: [
    {
      from: 7777,
      protocol: "tcp",
      to: 7777,
    },
    {
      from: 7878,
      protocol: "tcp",
      to: 7878,
    },
  ],
  requirements: {
    cpu: 1,
    disk: 5,
    memory: 2,
  },
  settings: terrariaSettings,
  usesJoinPassword: true,
} as const;
