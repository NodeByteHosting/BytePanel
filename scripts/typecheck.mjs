#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TEMP_TSCONFIG = join(ROOT, ".tsconfig.providers.typecheck.tmp.json");
const LOCAL_TSC_CLI = join(ROOT, "node_modules", "typescript", "bin", "tsc");
const PARENT_TSC_CLI = join(ROOT, "..", "..", "node_modules", "typescript", "bin", "tsc");
const ROOT_TSCONFIG = join(ROOT, "..", "..", "tsconfig.json");
const ROOT_PRICING = join(ROOT, "..", "..", "lib", "pricing.ts");

const tscConfig = existsSync(ROOT_TSCONFIG) && existsSync(ROOT_PRICING)
  ? {
    extends: "../../tsconfig.json",
    compilerOptions: {
      ignoreDeprecations: "6.0",
      incremental: false,
      noEmit: true,
    },
    include: ["./**/*.ts"],
    exclude: ["./.github/**", "./node_modules/**", "./scripts/**", "./**/*.d.ts"],
  }
  : {
    compilerOptions: {
      baseUrl: ".",
      ignoreDeprecations: "6.0",
      incremental: false,
      lib: ["ES2023"],
      module: "ESNext",
      moduleResolution: "Bundler",
      noEmit: true,
      paths: {
        "@/lib/pricing": ["./scripts/typecheck-shims/pricing.ts"],
      },
      strict: true,
      target: "ES2023",
      types: ["node"],
    },
    include: ["./**/*.ts", "./scripts/typecheck-shims/**/*.ts"],
    exclude: [
      "./.github/**",
      "./index.ts",
      "./node_modules/**",
      "./scripts/**",
      "./**/*.d.ts",
    ],
  };

writeFileSync(TEMP_TSCONFIG, `${JSON.stringify(tscConfig, null, 2)}\n`, "utf-8");

const tscCliPath = existsSync(LOCAL_TSC_CLI)
  ? LOCAL_TSC_CLI
  : existsSync(PARENT_TSC_CLI)
  ? PARENT_TSC_CLI
  : null;

if (!tscCliPath) {
  console.error(
    "Could not find TypeScript CLI. Install dependencies in this repo (npm install) or parent workspace.",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [tscCliPath, "--project", TEMP_TSCONFIG, "--pretty", "false"],
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
