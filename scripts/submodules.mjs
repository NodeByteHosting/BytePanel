#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const colors = {
  blue: "\u001B[34m",
  green: "\u001B[32m",
  red: "\u001B[31m",
  reset: "\u001B[0m",
  yellow: "\u001B[33m",
};

const log = {
  err: (msg) => console.error(`${colors.red}${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  ok: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
};

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf-8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (opts.capture) {
    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";
    return { code: result.status ?? 1, stderr, stdout };
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  return { code: 0, stderr: "", stdout: "" };
};

const git = (args, opts = {}) => run("git", args, opts);

const resolveGitAuthToken = () =>
  process.env.GIT_AUTH_TOKEN ??
  process.env.VERCEL_SANDBOX_GIT_TOKEN ??
  process.env.GITHUB_TOKEN;

const configureGitAuth = (repoRoot, command) => {
  const token = resolveGitAuthToken();
  const needsRemoteAccess = command === "setup" || command === "update";

  if (!token) {
    if (needsRemoteAccess && (process.env.CI || process.env.VERCEL)) {
      log.err(
        "✗ Missing GitHub token for private submodules. Set GIT_AUTH_TOKEN (or VERCEL_SANDBOX_GIT_TOKEN / GITHUB_TOKEN) in build environment."
      );
      process.exit(1);
    }
    return [];
  }

  const encodedToken = encodeURIComponent(token);
  const authArg =
    `url.https://x-access-token:${encodedToken}@github.com/.insteadOf=` +
    "https://github.com/";

  log.info("🔐 GitHub token detected for submodule auth");

  // Allow git submodule update to clone private GitHub repos non-interactively.
  git(
    [
      "config",
      "--global",
      `url.https://x-access-token:${encodedToken}@github.com/.insteadOf`,
      "https://github.com/",
    ],
    { cwd: repoRoot }
  );

  // Also inject rewrite per-command so containerized builds don't depend on
  // global git config persistence between build phases.
  return ["-c", authArg];
};

const getRepoRoot = () => {
  const r = git(["rev-parse", "--show-toplevel"], { capture: true });
  if (r.code !== 0 || !r.stdout) {
    log.err("✗ Not inside a git repository");
    process.exit(1);
  }
  return r.stdout;
};

const getSubmodulePaths = (repoRoot) => {
  if (!existsSync(`${repoRoot}/.gitmodules`)) {
    log.err("✗ .gitmodules not found");
    process.exit(1);
  }

  const r = git(
    ["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"],
    { capture: true, cwd: repoRoot }
  );

  if (r.code !== 0 || !r.stdout) {
    log.err("✗ No submodule paths found in .gitmodules");
    process.exit(1);
  }

  return r.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/u)[1])
    .filter(Boolean);
};

const getConfiguredBranch = (repoRoot, submodulePath) => {
  const key = `submodule.${submodulePath}.branch`;
  const r = git(["config", "-f", ".gitmodules", "--get", key], {
    capture: true,
    cwd: repoRoot,
  });
  if (r.code === 0 && r.stdout) {
    return r.stdout;
  }
  return "main";
};

const redactRemote = (url) =>
  url.replace(/https:\/\/[^@\s]+@github\.com\//u, "https://***@github.com/");

const normalizePath = (path) => resolve(path).replaceAll("\\", "/");

const getRequiredMarker = (submodule) => {
  if (submodule === "games") {
    return "index.ts";
  }
  if (submodule === "agent") {
    return "package.json";
  }
  if (submodule === "lib/providers") {
    return "index.ts";
  }
  return ".git";
};

const validateSubmodule = (repoRoot, submodule) => {
  console.log(`\n${colors.blue}• ${submodule}${colors.reset}`);

  const indexEntry = git(["ls-files", "--stage", "--", submodule], {
    capture: true,
    cwd: repoRoot,
  })
    .stdout.split("\n")
    .map((l) => l.trim())
    .find(Boolean);

  const [mode, gitlinkSha] = indexEntry?.split(/\s+/u) ?? [];

  if (mode !== "160000") {
    log.err(
      `  ✗ Not registered as gitlink in index (mode=${mode ?? "missing"})`
    );
    return { failed: true, gitlinkFailure: true };
  }

  const repoCheck = git(
    ["-C", submodule, "rev-parse", "--is-inside-work-tree"],
    {
      capture: true,
      cwd: repoRoot,
    }
  );

  if (repoCheck.code !== 0) {
    log.err("  ✗ Directory is not an initialized git repository");
    return { failed: true, gitlinkFailure: false };
  }

  const topLevel = git(["-C", submodule, "rev-parse", "--show-toplevel"], {
    capture: true,
    cwd: repoRoot,
  });
  const expectedTopLevel = normalizePath(`${repoRoot}/${submodule}`);
  const actualTopLevel = normalizePath(topLevel.stdout || "");

  if (topLevel.code !== 0 || actualTopLevel !== expectedTopLevel) {
    log.err(
      "  ✗ Submodule path is not an isolated checkout (likely missing initialization)"
    );
    return { failed: true, gitlinkFailure: false };
  }

  const head = git(["-C", submodule, "rev-parse", "HEAD"], {
    capture: true,
    cwd: repoRoot,
  });
  if (head.code !== 0 || !head.stdout || head.stdout !== gitlinkSha) {
    log.err(
      `  ✗ Checkout mismatch (expected ${gitlinkSha ?? "unknown"}, got ${head.stdout || "unknown"})`
    );
    return { failed: true, gitlinkFailure: false };
  }

  const marker = `${repoRoot}/${submodule}/${getRequiredMarker(submodule)}`;
  if (!existsSync(marker)) {
    log.err(`  ✗ Missing expected file: ${marker}`);
    return { failed: true, gitlinkFailure: false };
  }

  const branch = git(["-C", submodule, "branch", "--show-current"], {
    capture: true,
    cwd: repoRoot,
  }).stdout;

  if (branch) {
    log.ok(`  ✓ Branch: ${branch}`);
  } else {
    log.warn("  ⚠ Detached HEAD");
  }

  const remote = git(["-C", submodule, "remote", "get-url", "origin"], {
    capture: true,
    cwd: repoRoot,
  });

  if (remote.code !== 0 || !remote.stdout) {
    log.warn("  ⚠ No origin remote configured");
  } else {
    log.ok(`  ✓ Origin: ${redactRemote(remote.stdout)}`);
  }

  log.ok("  ✓ Registered and initialized");
  return { failed: false, gitlinkFailure: false };
};

const validate = (repoRoot, submodules) => {
  log.info("🔍 Validating submodules...");
  let failures = 0;
  let gitlinkFailures = 0;

  for (const submodule of submodules) {
    const result = validateSubmodule(repoRoot, submodule);
    if (result.failed) {
      failures += 1;
    }
    if (result.gitlinkFailure) {
      gitlinkFailures += 1;
    }
  }

  console.log();
  if (failures > 0) {
    log.err(`✗ Submodule validation failed (${failures} issue(s))`);
    if (gitlinkFailures > 0) {
      console.log();
      log.warn(
        "Detected directories tracked as regular files instead of submodules."
      );
      console.log("Repair from repo root:");
      console.log("  git rm -r --cached agent games lib/providers");
      console.log(
        "  # move or delete the existing folders before re-adding submodules"
      );
      console.log(
        "  # for example: ren agent agent.backup, ren games games.backup, ren lib\\providers providers.backup"
      );
      console.log(
        "  # if a previous submodule add failed, remove leftover git dirs too:"
      );
      console.log(
        "  #   Remove-Item -Recurse -Force .git\\modules\\agent,.git\\modules\\games,.git\\modules\\lib\\providers"
      );
      console.log(
        "  # for empty remote repos, add without -b main on the first pass"
      );
      console.log(
        "  git submodule add https://github.com/NodeByteHosting/GSA.git agent"
      );
      console.log(
        "  git submodule add https://github.com/NodeByteHosting/GSG.git games"
      );
      console.log(
        "  git submodule add https://github.com/NodeByteHosting/GSP.git lib/providers"
      );
      console.log("  # then create/push main inside each submodule:");
      console.log(
        '  #   cd agent && git switch -c main && git add . && git commit -m "feat: initial commit" && git push -u origin main'
      );
      console.log(
        '  #   cd games && git switch -c main && git add . && git commit -m "feat: initial commit" && git push -u origin main'
      );
      console.log(
        '  #   cd lib/providers && git switch -c main && git add . && git commit -m "feat: initial commit" && git push -u origin main'
      );
      console.log("  bun run submodules:setup");
    }
    return 1;
  }

  log.ok("✓ All submodules validated successfully");
  return 0;
};

const setup = (repoRoot, submodules, authArgs) => {
  const forceFresh = Boolean(process.env.CI || process.env.VERCEL);

  log.info("🔧 Syncing submodule remotes...");
  git([...authArgs, "submodule", "sync", "--recursive"], { cwd: repoRoot });

  if (forceFresh) {
    log.info("🧹 CI/Vercel: forcing fresh submodule checkout...");
    git([...authArgs, "submodule", "deinit", "--all", "--force"], {
      cwd: repoRoot,
    });
  }

  log.info("🔧 Initializing and updating submodules...");
  git(
    [...authArgs, "submodule", "update", "--init", "--recursive", "--force"],
    {
      cwd: repoRoot,
    }
  );

  return validate(repoRoot, submodules);
};

const status = (repoRoot) => {
  git(["submodule", "status", "--recursive"], { cwd: repoRoot });
  return 0;
};

const update = (repoRoot, authArgs) => {
  log.info("🔧 Syncing submodule remotes...");
  git([...authArgs, "submodule", "sync", "--recursive"], { cwd: repoRoot });

  log.info("🔧 Updating submodules to latest configured branches...");
  git(
    [...authArgs, "submodule", "update", "--init", "--recursive", "--remote"],
    {
      cwd: repoRoot,
    }
  );

  git(["submodule", "status", "--recursive"], { cwd: repoRoot });
  return 0;
};

const push = (repoRoot, submodules) => {
  const valid = validate(repoRoot, submodules);
  if (valid !== 0) {
    return valid;
  }

  log.info("📤 Pushing submodules...");
  for (const submodule of submodules) {
    console.log(`\nPushing ${submodule}...`);

    let branch = git(["-C", submodule, "rev-parse", "--abbrev-ref", "HEAD"], {
      capture: true,
      cwd: repoRoot,
    }).stdout;

    if (branch === "HEAD") {
      const target = getConfiguredBranch(repoRoot, submodule);
      log.warn(`  ⚠ Detached HEAD detected. Trying to checkout '${target}'...`);
      const checkout = git(["-C", submodule, "checkout", target], {
        capture: true,
        cwd: repoRoot,
      });

      if (checkout.code !== 0) {
        log.err(`  ✗ Could not checkout '${target}' in ${submodule}`);
        return 1;
      }

      branch = target;
    }

    const pushResult = git(["-C", submodule, "push", "origin", branch], {
      capture: true,
      cwd: repoRoot,
    });

    if (pushResult.code !== 0) {
      log.warn(`  ⚠ Push failed for ${submodule}. Retrying with upstream...`);
      const upstream = git(["-C", submodule, "push", "-u", "origin", branch], {
        capture: true,
        cwd: repoRoot,
      });
      if (upstream.code !== 0) {
        log.err(`  ✗ Push failed for ${submodule}`);
        return 1;
      }
    }

    log.ok(`  ✓ Pushed ${submodule} (${branch})`);
  }

  const mainBranch = git(["rev-parse", "--abbrev-ref", "HEAD"], {
    capture: true,
    cwd: repoRoot,
  }).stdout;

  console.log(`\nPushing main repo branch '${mainBranch}'...`);
  git(["push", "origin", mainBranch], { cwd: repoRoot });
  log.ok("✓ All submodules and main repo pushed");

  return 0;
};

const main = () => {
  const command = process.argv[2] ?? "help";
  const repoRoot = getRepoRoot();
  const submodules = getSubmodulePaths(repoRoot);

  const authArgs = configureGitAuth(repoRoot, command);

  const handlers = {
    push: () => push(repoRoot, submodules),
    setup: () => setup(repoRoot, submodules, authArgs),
    status: () => status(repoRoot),
    update: () => update(repoRoot, authArgs),
    validate: () => validate(repoRoot, submodules),
  };

  const handler = handlers[command];
  if (!handler) {
    console.log(
      "Usage: node scripts/submodules.mjs <setup|validate|status|update|push>"
    );
    process.exit(1);
  }

  process.exit(handler());
};

main();
