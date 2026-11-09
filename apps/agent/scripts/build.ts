import { existsSync, mkdirSync } from "node:fs";

const git = Bun.spawnSync(["git", "rev-parse", "HEAD"], { stderr: "ignore" });
const commit =
  process.env.AGENT_COMMIT_SHA ??
  (git.exitCode === 0 ? git.stdout.toString().trim() : "");

if (!existsSync("dist")) {
  mkdirSync("dist", { recursive: true });
}

const build = Bun.spawnSync(
  [
    process.execPath,
    "build",
    "--compile",
    "--target=bun-linux-x64",
    "--define",
    `__AGENT_COMMIT__=${JSON.stringify(commit)}`,
    "./src/index.ts",
    "--outfile",
    "dist/bytepanel-daemon",
  ],
  { stderr: "inherit", stdout: "inherit" }
);

process.exit(build.exitCode ?? 1);
