#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TEMP_TSCONFIG = join(ROOT, ".tsconfig.providers.typecheck.tmp.json");
const TSC_CLI = join(ROOT, "..", "..", "node_modules", "typescript", "bin", "tsc");

const tscConfig = {
  extends: "../../tsconfig.json",
  compilerOptions: {
    incremental: false,
    noEmit: true,
  },
  include: ["./**/*.ts"],
  exclude: ["./.github/**", "./node_modules/**", "./scripts/**", "./**/*.d.ts"],
};

writeFileSync(TEMP_TSCONFIG, `${JSON.stringify(tscConfig, null, 2)}\n`, "utf-8");

if (!existsSync(TSC_CLI)) {
  console.error(
    "Could not find TypeScript CLI at ../../node_modules/typescript/bin/tsc. Install workspace dependencies first.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [TSC_CLI, "--project", TEMP_TSCONFIG, "--pretty", "false"],
  {
    cwd: ROOT,
    shell: false,
    stdio: "inherit",
  },
);

try {
  rmSync(TEMP_TSCONFIG, { force: true });
} catch {
  // Ignore cleanup failures so typecheck errors remain primary.
}

process.exit(result.status ?? 1);
