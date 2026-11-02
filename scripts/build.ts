// Compiles the daemon to a single binary, stamping in the git commit so the
// panel can tell which build a node runs. Run from the agent directory.
import { existsSync, mkdirSync } from "node:fs";

const git = Bun.spawnSync(["git", "rev-parse", "HEAD"], { stderr: "ignore" });
const commit =
  process.env.AGENT_COMMIT_SHA ??
  (git.exitCode === 0 ? git.stdout.toString().trim() : "");

if (!existsSync("../dist")) {
  mkdirSync("../dist", { recursive: true });
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
    "../dist/nodebyte-daemon",
  ],
  { stderr: "inherit", stdout: "inherit" }
);

process.exit(build.exitCode ?? 1);
