import { describe, expect, test } from "bun:test";

import { validateVariable } from "@/lib/eggs/rules";

import { eggs, games } from "../games/index";

// Placeholders the panel resolves itself (see lib/eggs/placeholders.ts).
const BUILT_IN =
  /^(SERVER_MEMORY|SERVER_PORT|SERVER_IP|SERVER_PORT_\d+|server\.[\w.]+|env\.\w+|config\.docker\.interface)$/u;

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)].map((m) => m[1] ?? "");

describe("built-in GSG eggs", () => {
  test("every enabled game has an egg with a matching slug", () => {
    const slugs = new Set(eggs.map((e) => e.slug));
    for (const game of games.filter((g) => g.enabled)) {
      expect(slugs.has(game.id)).toBe(true);
    }
    expect(slugs.size).toBe(eggs.length);
  });

  for (const egg of eggs) {
    describe(egg.slug, () => {
      const envs = egg.variables.map((v) => v.env);

      test("variable names are unique", () => {
        expect(new Set(envs).size).toBe(envs.length);
      });

      test("defaults satisfy their own rules", () => {
        for (const variable of egg.variables) {
          // Placeholder and "@random" defaults are resolved at runtime.
          if (
            variable.default.includes("{{") ||
            variable.default === "@random"
          ) {
            continue;
          }
          // Required-but-empty defaults force the customer to enter a value.
          if (variable.default === "" && variable.rules.includes("required")) {
            continue;
          }
          expect(
            validateVariable(variable.default, variable.rules, variable.env)
          ).toBeNull();
        }
      });

      test("placeholders reference known variables", () => {
        const sources = [
          egg.startup,
          ...egg.variables.map((v) => v.default),
          ...(egg.configFiles ?? []).flatMap((f) =>
            f.replace.map((r) => r.value)
          ),
        ];
        for (const name of sources.flatMap(placeholders)) {
          expect(envs.includes(name) || BUILT_IN.test(name)).toBe(true);
        }
      });

      test("extra port placeholders fit the allocations the egg requests", () => {
        const ports = Math.max(1, egg.containerPorts?.length ?? 0);
        const sources = [egg.startup, ...egg.variables.map((v) => v.default)];
        for (const name of sources.flatMap(placeholders)) {
          const extra = /^SERVER_PORT_(\d+)$/u.exec(name);
          if (extra) {
            expect(Number(extra[1])).toBeLessThan(ports);
          }
        }
      });

      test("image-user eggs set a sensible volume owner format", () => {
        if (egg.volumeOwner) {
          expect(egg.volumeOwner).toMatch(/^\d+:\d+$/u);
        }
      });
    });
  }
});
