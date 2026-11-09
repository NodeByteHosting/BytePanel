import { cs2 } from "./cs2";
import { dontStarveTogether } from "./dontstarvetogether";
import { enshrouded } from "./enshrouded";
import { fivem } from "./fivem";
import { gmod } from "./gmod";
import { hytale } from "./hytale";
import { l4d2 } from "./l4d2";
import { minecraft } from "./minecraft";
import { palworld } from "./palworld";
import { redm } from "./redm";
import { rust } from "./rust";
import { satisfactory } from "./satisfactory";
import { terraria } from "./terraria";
import { valheim } from "./valheim";
import { vrising } from "./vrising";

export { steamHeader } from "./steam";

export const games = [
  cs2,
  minecraft,
  rust,
  l4d2,
  hytale,
  fivem,
  redm,
  gmod,
  terraria,
  palworld,
  satisfactory,
  dontStarveTogether,
  enshrouded,
  valheim,
  vrising,
];

export type Game = (typeof games)[number];

export const getGame = (id: string): Game | undefined =>
  games.find((g) => g.id === id);

export {
  defineSettings,
  getDefaults,
  hasRequiredFields,
  missingRequiredFields,
  resolveSettings,
  type SettingField,
  type SettingsSchema,
  type SettingsValues,
  validateSettings,
} from "./settings";

import { cs2Egg } from "./cs2/egg";
import { dontStarveTogetherEgg } from "./dontstarvetogether/egg";
import { enshroudedEgg } from "./enshrouded/egg";
import { fivemEgg } from "./fivem/egg";
import { gmodEgg } from "./gmod/egg";
import { hytaleEgg } from "./hytale/egg";
import { l4d2Egg } from "./l4d2/egg";
import { minecraftEgg } from "./minecraft/egg";
import { palworldEgg } from "./palworld/egg";
import { redmEgg } from "./redm/egg";
import { rustEgg } from "./rust/egg";
import { satisfactoryEgg } from "./satisfactory/egg";
import { terrariaEgg } from "./terraria/egg";
import { valheimEgg } from "./valheim/egg";
import { vrisingEgg } from "./vrising/egg";

export const eggs = [
  cs2Egg,
  minecraftEgg,
  rustEgg,
  l4d2Egg,
  hytaleEgg,
  fivemEgg,
  redmEgg,
  gmodEgg,
  terrariaEgg,
  palworldEgg,
  satisfactoryEgg,
  dontStarveTogetherEgg,
  enshroudedEgg,
  valheimEgg,
  vrisingEgg,
];

export type {
  EggConfigFile,
  EggDefinition,
  EggVariable,
} from "./egg";
