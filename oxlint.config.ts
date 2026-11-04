import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  ignorePatterns: [
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
  rules: {
    // Reports code the React Compiler would skip optimising (try/finally,
    // throw inside try, etc.). The compiler isn't enabled in next.config.ts,
    // so these are informational, not bugs.
    "react/todo": "off",
  },
});
