import "server-only";
import crypto from "node:crypto";

import { Sandbox } from "@vercel/sandbox";
import { FatalError } from "workflow";

const BUN_INSTALL = "curl -fsSL https://bun.sh/install | bash";
// Root install is required because agent/src/*.ts imports from ../../protocol,
// which lives at the repo root and pulls in zod from the root node_modules.
const BUILD_SCRIPT = [
  'export PATH="$HOME/.bun/bin:$PATH"',
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

  const token = process.env.VERCEL_SANDBOX_GIT_TOKEN;
  if (token) {
    return { password: token, revision: sha, url, username: "x-access-token" };
  }
  return { revision: sha, url };
};

const sha256 = (buf: Buffer): string =>
  crypto.createHash("sha256").update(buf).digest("hex");

/**
 * Validate that the environment has the credentials needed for Vercel Sandbox.
 * Throws a descriptive error early so admins see exactly what is missing rather
 * than a generic "Status code 400" from deep inside the SDK.
 */
const assertSandboxEnv = (git: GitSource) => {
  const hasToken = Boolean(process.env.VERCEL_SANDBOX_GIT_TOKEN);
  const isGitHub = git.url.includes("github.com");

  if (isGitHub && !hasToken && !git.username) {
    throw new FatalError(
      `VERCEL_SANDBOX_GIT_TOKEN is not set. Vercel Sandbox cannot clone a private ` +
        `GitHub repo without credentials. ` +
        `Set VERCEL_SANDBOX_GIT_TOKEN to a GitHub PAT with repo read access.`
    );
  }

  // The SDK infers team/project from ~/.vercel/auth.json in dev or from
  // VERCEL_ACCESS_TOKEN in CI/production. Without either, Sandbox.create will
  // return 400/401 with no useful message.
  const hasVercelCreds =
    Boolean(process.env.VERCEL_ACCESS_TOKEN) ||
    Boolean(process.env.VERCEL_TOKEN);
  // The SDK can also infer from the local Vercel CLI JSON — only warn if we
  // have no explicit token in CI, because local dev will usually work.
  if (!hasVercelCreds && process.env.NODE_ENV === "production") {
    throw new FatalError(
      `VERCEL_ACCESS_TOKEN is not set. Vercel Sandbox requires an access token ` +
        `in production. Set VERCEL_ACCESS_TOKEN to a Vercel API token with ` +
        `"Sandbox" scope enabled for your team.`
    );
  }
};

export const compileAgentBinary = async (): Promise<{
  bytes: Buffer;
  sha: string;
}> => {
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
    });
    if (installBun.exitCode !== 0) {
      throw new Error(
        `bun install script failed (exit ${installBun.exitCode}): ${await installBun.stderr()}`
      );
    }

    const build = await sandbox.runCommand({
      args: ["-c", BUILD_SCRIPT],
      cmd: "bash",
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
