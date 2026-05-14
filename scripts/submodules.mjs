#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const colors = {
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  ok: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  err: (msg) => console.error(`${colors.red}${msg}${colors.reset}`),
};

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (opts.capture) {
    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";
    return { code: result.status ?? 1, stdout, stderr };
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  return { code: 0, stdout: "", stderr: "" };
}

function git(args, opts = {}) {
  return run("git", args, opts);
}

function getRepoRoot() {
  const r = git(["rev-parse", "--show-toplevel"], { capture: true });
  if (r.code !== 0 || !r.stdout) {
    log.err("✗ Not inside a git repository");
    process.exit(1);
  }
  return r.stdout;
}

function getSubmodulePaths(repoRoot) {
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
    .map((line) => line.split(/\s+/)[1])
    .filter(Boolean);
}

function getConfiguredBranch(repoRoot, submodulePath) {
  const key = `submodule.${submodulePath}.branch`;
  const r = git(["config", "-f", ".gitmodules", "--get", key], {
    capture: true,
    cwd: repoRoot,
  });
  if (r.code === 0 && r.stdout) {
    return r.stdout;
  }
  return "main";
}

function validate(repoRoot, submodules) {
  log.info("🔍 Validating submodules...");
  let failures = 0;
  let gitlinkFailures = 0;

  for (const submodule of submodules) {
    console.log(`\n${colors.blue}• ${submodule}${colors.reset}`);

    const mode = git(["ls-files", "--stage", "--", submodule], {
      capture: true,
      cwd: repoRoot,
    }).stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0]
      ?.split(/\s+/)[0];

    if (mode !== "160000") {
      log.err(`  ✗ Not registered as gitlink in index (mode=${mode ?? "missing"})`);
      failures += 1;
      gitlinkFailures += 1;
      continue;
    }

    const repoCheck = git(["-C", submodule, "rev-parse", "--is-inside-work-tree"], {
      capture: true,
      cwd: repoRoot,
    });

    if (repoCheck.code !== 0) {
      log.err("  ✗ Directory is not an initialized git repository");
      failures += 1;
      continue;
    }

    const branch = git(["-C", submodule, "branch", "--show-current"], {
      capture: true,
      cwd: repoRoot,
    }).stdout;

    if (!branch) {
      log.warn("  ⚠ Detached HEAD");
    } else {
      log.ok(`  ✓ Branch: ${branch}`);
    }

    const remote = git(["-C", submodule, "remote", "get-url", "origin"], {
      capture: true,
      cwd: repoRoot,
    });

    if (remote.code !== 0 || !remote.stdout) {
      log.warn("  ⚠ No origin remote configured");
    } else {
      log.ok(`  ✓ Origin: ${remote.stdout}`);
    }

    log.ok("  ✓ Registered and initialized");
  }

  console.log();
  if (failures > 0) {
    log.err(`✗ Submodule validation failed (${failures} issue(s))`);
    if (gitlinkFailures > 0) {
      console.log();
      log.warn("Detected directories tracked as regular files instead of submodules.");
      console.log("Repair from repo root:");
      console.log("  git rm -r --cached agent games lib/providers");
      console.log("  # move or delete the existing folders before re-adding submodules");
      console.log("  # for example: ren agent agent.backup, ren games games.backup, ren lib\\providers providers.backup");
      console.log("  # if a previous submodule add failed, remove leftover git dirs too:");
      console.log("  #   Remove-Item -Recurse -Force .git\\modules\\agent,.git\\modules\\games,.git\\modules\\lib\\providers");
      console.log("  # for empty remote repos, add without -b main on the first pass");
      console.log("  git submodule add https://github.com/NodeByteHosting/GSA.git agent");
      console.log("  git submodule add https://github.com/NodeByteHosting/GSG.git games");
      console.log("  git submodule add https://github.com/NodeByteHosting/GSP.git lib/providers");
      console.log("  # then create/push main inside each submodule:");
      console.log("  #   cd agent && git switch -c main && git add . && git commit -m \"feat: initial commit\" && git push -u origin main");
      console.log("  #   cd games && git switch -c main && git add . && git commit -m \"feat: initial commit\" && git push -u origin main");
      console.log("  #   cd lib/providers && git switch -c main && git add . && git commit -m \"feat: initial commit\" && git push -u origin main");
      console.log("  bun run submodules:setup");
    }
    return 1;
  }

  log.ok("✓ All submodules validated successfully");
  return 0;
}

function setup(repoRoot, submodules) {
  log.info("🔧 Syncing submodule remotes...");
  git(["submodule", "sync", "--recursive"], { cwd: repoRoot });

  log.info("🔧 Initializing and updating submodules...");
  git(["submodule", "update", "--init", "--recursive"], { cwd: repoRoot });

  return validate(repoRoot, submodules);
}

function status(repoRoot) {
  git(["submodule", "status", "--recursive"], { cwd: repoRoot });
  return 0;
}

function update(repoRoot) {
  log.info("🔧 Syncing submodule remotes...");
  git(["submodule", "sync", "--recursive"], { cwd: repoRoot });

  log.info("🔧 Updating submodules to latest configured branches...");
  git(["submodule", "update", "--init", "--recursive", "--remote"], {
    cwd: repoRoot,
  });

  git(["submodule", "status", "--recursive"], { cwd: repoRoot });
  return 0;
}

function push(repoRoot, submodules) {
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
}

function main() {
  const command = process.argv[2] ?? "help";
  const repoRoot = getRepoRoot();
  const submodules = getSubmodulePaths(repoRoot);

  switch (command) {
    case "setup":
      process.exit(setup(repoRoot, submodules));
    case "validate":
      process.exit(validate(repoRoot, submodules));
    case "status":
      process.exit(status(repoRoot));
    case "update":
      process.exit(update(repoRoot));
    case "push":
      process.exit(push(repoRoot, submodules));
    default:
      console.log("Usage: node scripts/submodules.mjs <setup|validate|status|update|push>");
      process.exit(1);
  }
}

main();
