import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Why: packages/protocol (shared zod schemas) is compiled into both the panel and the
// node daemon (apps/agent). Two different zod versions produce structurally
// incompatible schema types and subtly different runtime validation, so both
// packages must pin the exact same zod release. `npm-check-updates` and
// similar tools love to bump this — guard the pin here.

const ROOT = path.join(import.meta.dir, "..");

interface PackageJson {
  dependencies?: Record<string, string>;
}

const readPackageJson = (dir: string): PackageJson =>
  JSON.parse(
    readFileSync(path.join(dir, "package.json"), "utf-8")
  ) as PackageJson;

describe("zod version pin", () => {
  test("panel pins zod to an exact version (no ^ or ~)", () => {
    const zod = readPackageJson(ROOT).dependencies?.zod;
    expect(zod).toBeDefined();
    expect(zod).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  test("daemon (apps/agent) pins the same zod as the panel", () => {
    const panel = readPackageJson(ROOT).dependencies?.zod;
    const daemon = readPackageJson(path.join(ROOT, "..", "agent")).dependencies
      ?.zod;
    expect(daemon).toBe(panel);
  });

  test("protocol package pins the same zod as the panel", () => {
    const panel = readPackageJson(ROOT).dependencies?.zod;
    const protocol = readPackageJson(
      path.join(ROOT, "..", "..", "packages", "protocol")
    ).dependencies?.zod;
    expect(protocol).toBe(panel);
  });
});
