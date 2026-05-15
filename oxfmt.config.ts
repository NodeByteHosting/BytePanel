import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "agent/**",
    "games/**",
    "lib/providers/**",
    "components/ui",
    "components/ai-elements",
    "components/kibo-ui",
    "lib/utils.ts",
    "lib/providers/hetzner/schema.ts",
    "hooks/use-mobile.ts",
  ],
});
