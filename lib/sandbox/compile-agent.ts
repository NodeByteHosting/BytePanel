import "server-only";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Sandbox } from "@vercel/sandbox";
import { FatalError } from "workflow";

const BUN_INSTALL = "curl -fsSL https://bun.sh/install | bash";
// Root install is required because agent/src/*.ts imports from ../../protocol,
// which lives at the repo root and pulls in zod from the root node_modules.
const GIT_AUTH_REWRITE = `git config --global url."https://x-access-token:\${GIT_AUTH_TOKEN}@github.com/".insteadOf "https://github.com/"`;
const BUILD_SCRIPT = [
  'export PATH="$HOME/.bun/bin:$PATH"',
  GIT_AUTH_REWRITE,
  "git submodule sync --recursive",
  "git submodule update --init --recursive",
  "bun install --production --ignore-scripts",
  "cd agent",
  "bun install --production --ignore-scripts",
  "bun build --compile --target=bun-linux-x64 ./src/index.ts --outfile ../dist/nodebyte-agent",
].join(" && ");

interface GitSource {
  url: string;
  revision: string;
  username?: string;
  password?: string;
}

const AGENT_BINARY_PATH = "dist/nodebyte-agent";

const runBun = (
  args: string[],
  cwd: string
): { stderr: string; stdout: string; status: number } => {
  const result = spawnSync("bun", args, {
    cwd,
    encoding: "utf-8",
    shell: false,
  });
  return {
    status: result.status ?? 1,
    stderr: result.stderr?.toString() ?? "",
    stdout: result.stdout?.toString() ?? "",
  };
};

const sha256 = (buf: Buffer): string =>
  crypto.createHash("sha256").update(buf).digest("hex");

const compileAgentLocally = (): { bytes: Buffer; sha: string } => {
  const repoRoot = process.cwd();
  const agentDir = join(repoRoot, "agent");

  if (!existsSync(agentDir)) {
    throw new FatalError(
      "Local agent directory not found. Expected a checked-out `agent/` submodule in the repo root."
    );
  }

  const install = runBun(
    ["install", "--production", "--ignore-scripts"],
    agentDir
  );
  if (install.status !== 0) {
    throw new FatalError(
      `Local agent dependency install failed (exit ${install.status}): ${install.stderr || install.stdout}`
    );
  }

  const build = runBun(
    [
      "build",
      "--compile",
      "--target=bun-linux-x64",
      "./src/index.ts",
      "--outfile",
      "../dist/nodebyte-agent",
    ],
    agentDir
  );
  if (build.status !== 0) {
    throw new FatalError(
      `Local agent build failed (exit ${build.status}): ${build.stderr || build.stdout}`
    );
  }

  const buffer = readFileSync(join(repoRoot, AGENT_BINARY_PATH));
  if (!buffer.length) {
    throw new FatalError(
      "Local agent build produced no dist/nodebyte-agent file"
    );
  }

  return { bytes: buffer, sha: sha256(buffer) };
};

const resolveGitSource = (): GitSource => {
  const explicitUrl = process.env.NBP_GIT_REPO_URL;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NBP_GIT_REVISION;

  if (!sha) {
    throw new Error(
      "No git revision available. Set VERCEL_GIT_COMMIT_SHA (Vercel injects this) or NBP_GIT_REVISION for local dev."
    );
  }

  const url =
    explicitUrl ??
    (owner && slug ? `https://github.com/${owner}/${slug}` : null);
  if (!url) {
    throw new Error(
      "No git URL available. Set NBP_GIT_REPO_URL or rely on VERCEL_GIT_REPO_OWNER/SLUG."
    );
  }

  // Accept any of these — one token should work everywhere.
  const token =
    process.env.GIT_AUTH_TOKEN ??
    process.env.VERCEL_SANDBOX_GIT_TOKEN ??
    process.env.GITHUB_TOKEN;
  if (token) {
    return { password: token, revision: sha, url, username: "x-access-token" };
  }
  return { revision: sha, url };
};

/**
 * Validate that the environment has the credentials needed for Vercel Sandbox.
 * Throws a descriptive error early so admins see exactly what is missing rather
 * than a generic "Status code 400" from deep inside the SDK.
 */
const assertSandboxEnv = (git: GitSource) => {
  const hasToken = Boolean(
    process.env.GIT_AUTH_TOKEN ??
    process.env.VERCEL_SANDBOX_GIT_TOKEN ??
    process.env.GITHUB_TOKEN
  );
  const isGitHub = git.url.includes("github.com");
  const needsSandboxCreds =
    process.platform === "win32" ||
    process.env.NODE_ENV === "production" ||
    process.env.NBP_USE_VERCEL_SANDBOX_AGENT_BUILD === "1";

  if (isGitHub && !hasToken && !git.username) {
    throw new FatalError(
      `No GitHub token found for private repo access. Set GIT_AUTH_TOKEN ` +
        `(or VERCEL_SANDBOX_GIT_TOKEN / GITHUB_TOKEN) to a PAT with repo read access.`
    );
  }

  // The SDK accepts OIDC tokens (VERCEL_OIDC_TOKEN, set via `vercel env pull`),
  // access tokens (VERCEL_ACCESS_TOKEN / VERCEL_TOKEN), or infers from
  // ~/.vercel/auth.json in dev. Without any of these, Sandbox.create will
  // return 400/401 with no useful message.
  const hasVercelCreds =
    Boolean(process.env.VERCEL_ACCESS_TOKEN) ||
    Boolean(process.env.VERCEL_TOKEN) ||
    Boolean(process.env.VERCEL_OIDC_TOKEN);

  if (needsSandboxCreds && !hasVercelCreds) {
    throw new FatalError(
      `No Vercel credentials found. Vercel Sandbox is required for agent ` +
        `compilation in this environment (Windows dev, production, or when ` +
        `NBP_USE_VERCEL_SANDBOX_AGENT_BUILD=1). Set VERCEL_ACCESS_TOKEN to a ` +
        `Vercel API token, or run \`vercel env pull\` to populate VERCEL_OIDC_TOKEN.`
    );
  }

  // In production, OIDC is injected automatically by Vercel. Explicit token is
  // only required in external CI environments that have neither.
  if (!hasVercelCreds && process.env.NODE_ENV === "production") {
    throw new FatalError(
      `No Vercel credentials found. Vercel Sandbox requires VERCEL_ACCESS_TOKEN ` +
        `or VERCEL_OIDC_TOKEN in production.`
    );
  }
};

export const compileAgentBinary = async (): Promise<{
  bytes: Buffer;
  sha: string;
}> => {
  const shouldUseSandbox =
    process.platform === "win32" ||
    process.env.NODE_ENV === "production" ||
    process.env.NBP_USE_VERCEL_SANDBOX_AGENT_BUILD === "1";

  // Local development on non-Windows hosts can build directly from the checked
  // out agent submodule. Windows dev must use Vercel Sandbox because Bun's
  // Linux target compile cannot be produced reliably on Windows.
  if (!shouldUseSandbox) {
    return compileAgentLocally();
  }

  const git = resolveGitSource();

  assertSandboxEnv(git);

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>>;
  try {
    sandbox = await Sandbox.create({
      resources: { vcpus: 4 },
      runtime: "node22",
      source: {
        revision: git.revision,
        type: "git",
        url: git.url,
        ...(git.username && git.password
          ? { password: git.password, username: git.username }
          : {}),
      },
      timeout: 10 * 60 * 1000,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // HTTP 400 from Sandbox.create almost always means: missing/invalid git
    // credentials, Sandbox not enabled for the team, or bad request params.
    let hint = "";
    if (msg.includes("400")) {
      hint =
        " (HTTP 400 — check VERCEL_SANDBOX_GIT_TOKEN is set and Vercel Sandbox is enabled for your team)";
    } else if (msg.includes("401") || msg.includes("403")) {
      hint =
        " (auth error — check VERCEL_ACCESS_TOKEN / VERCEL_SANDBOX_GIT_TOKEN)";
    }
    throw new FatalError(`Sandbox.create failed: ${msg}${hint}`);
  }

  try {
    const installBun = await sandbox.runCommand({
      args: ["-c", BUN_INSTALL],
      cmd: "bash",
      env: git.password ? { GIT_AUTH_TOKEN: git.password } : undefined,
    });
    if (installBun.exitCode !== 0) {
      throw new Error(
        `bun install script failed (exit ${installBun.exitCode}): ${await installBun.stderr()}`
      );
    }

    const build = await sandbox.runCommand({
      args: ["-c", BUILD_SCRIPT],
      cmd: "bash",
      env: git.password ? { GIT_AUTH_TOKEN: git.password } : undefined,
    });
    if (build.exitCode !== 0) {
      const combined = await build.output("both");
      throw new Error(
        `agent build failed (exit ${build.exitCode}): ${combined.slice(-2000)}`
      );
    }

    const bytes = await sandbox.readFileToBuffer({
      path: "dist/nodebyte-agent",
    });
    if (!bytes) {
      throw new Error("agent build produced no dist/nodebyte-agent file");
    }
    // Sanity floor — a real bun-compiled agent is ~100 MB. Anything noticeably
    // smaller means the bun build silently produced garbage (empty file, just
    // the bun runtime header, etc.) and we should fail loudly rather than
    // upload it to Blob and bake it into a snapshot.
    if (bytes.length < 1_000_000) {
      throw new Error(
        `agent binary suspiciously small (${bytes.length} bytes); expected ~100 MB`
      );
    }
    if (bytes[0] !== 0x7f || bytes[1] !== 0x45) {
      throw new Error(
        `agent binary is not an ELF (first bytes: ${[...bytes.subarray(0, 4)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")})`
      );
    }

    return { bytes, sha: sha256(bytes) };
  } finally {
    await sandbox.stop().catch(() => {
      // sandbox auto-terminates on timeout; best-effort stop
    });
  }
};
