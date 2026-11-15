import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import ssh2 from "ssh2";
import { z } from "zod";

import type { Config } from "./config";
import { CONFIG_PATH, loadConfig, saveConfig } from "./config";
import { Docker } from "./docker";
import { errorMessage } from "./log";

// Only the parts of /etc/pterodactyl/config.yml the agent cares about.
export const wingsConfigSchema = z.object({
  allowed_origins: z.array(z.string()).nullish(),
  api: z
    .object({
      ssl: z
        .object({
          cert: z.string().default(""),
          enabled: z.boolean().default(false),
          key: z.string().default(""),
        })
        .nullish(),
    })
    .nullish(),
  docker: z
    .object({
      network: z
        .object({
          dns: z.array(z.string()).nullish(),
          name: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  system: z
    .object({
      backup_directory: z.string().default("/var/lib/pterodactyl/backups"),
      data: z.string().default("/var/lib/pterodactyl/volumes"),
      root_directory: z.string().default("/var/lib/pterodactyl"),
      timezone: z.string().nullish(),
      user: z
        .object({
          gid: z.number().int().nonnegative(),
          uid: z.number().int().nonnegative(),
        })
        .nullish(),
    })
    .prefault({}),
  uuid: z.string(),
});

export type WingsConfig = z.infer<typeof wingsConfigSchema>;

/**
 * Merges what Wings knew about this node into the agent's config, so existing
 * server files, ownership and certificates keep working without changes.
 */
export const planWingsImport = (
  wings: WingsConfig,
  current: Config,
  force = false,
): { config: Config; notes: string[] } => {
  const notes: string[] = [];
  if (wings.uuid !== current.uuid) {
    if (!force) {
      throw new Error(
        `Wings is node ${wings.uuid} but the agent is configured for node ${current.uuid}. ` +
          "Run configure with this node's token from the panel, or pass --force.",
      );
    }
    notes.push(`node uuid differs (Wings ${wings.uuid}, agent ${current.uuid}); continuing because of --force`);
  }
  if (wings.system.data !== current.system.data) {
    notes.push(
      `using Wings' data directory ${wings.system.data} instead of ${current.system.data}; ` +
        "set the node's daemon base to match in the panel",
    );
  }
  const ssl = wings.api?.ssl;
  const useWingsCerts = current.api.ssl.enabled && ssl?.enabled && ssl.cert && ssl.key;
  return {
    config: {
      ...current,
      allowedOrigins: [...new Set([...current.allowedOrigins, ...(wings.allowed_origins ?? [])])],
      api: useWingsCerts ? { ...current.api, ssl: { cert: ssl.cert, enabled: true, key: ssl.key } } : current.api,
      docker: wings.docker?.network?.dns?.length
        ? { ...current.docker, dns: wings.docker.network.dns }
        : current.docker,
      system: {
        ...current.system,
        data: wings.system.data,
        timezone: wings.system.timezone ?? current.system.timezone,
        user: wings.system.user ?? current.system.user,
      },
    },
    notes,
  };
};

interface WingsContainer {
  Id: string;
  Names: string[];
  State: string;
}

const wingsContainers = async (docker: Docker): Promise<WingsContainer[]> => {
  const filters = encodeURIComponent(JSON.stringify({ label: ["Service=Pterodactyl"] }));
  const res = await docker.request("GET", `/containers/json?all=true&filters=${filters}`);
  return (await res.json()) as WingsContainer[];
};

const containerName = (container: WingsContainer) =>
  container.Names[0]?.replace(/^\//u, "") ?? container.Id.slice(0, 12);

const systemctl = async (...args: string[]): Promise<{ code: number; out: string } | null> => {
  try {
    const proc = Bun.spawn({ cmd: ["systemctl", ...args], stderr: "pipe", stdout: "pipe" });
    const [code, out, err] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    return { code, out: (out || err).trim() };
  } catch {
    return null;
  }
};

const moveFile = async (from: string, to: string): Promise<void> => {
  try {
    await rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }
    await copyFile(from, to);
    await rm(from);
  }
};

export const importWings = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      config: { default: CONFIG_PATH, type: "string" },
      "dry-run": { default: false, type: "boolean" },
      force: { default: false, type: "boolean" },
      "stop-running": { default: false, type: "boolean" },
      "wings-config": { default: "/etc/pterodactyl/config.yml", type: "string" },
      "wings-service": { default: "wings", type: "string" },
    },
  });
  const dryRun = values["dry-run"];
  const step = (message: string) => console.log(`${dryRun ? "would " : ""}${message}`);

  if (!dryRun && process.getuid?.() !== 0) {
    throw new Error("import-wings must run as root: it stops Wings and moves server files");
  }
  if (!existsSync(values["wings-config"])) {
    throw new Error(`No Wings config at ${values["wings-config"]} (pass --wings-config)`);
  }
  const wings = wingsConfigSchema.parse(Bun.YAML.parse(await readFile(values["wings-config"], "utf-8")));
  const current = await loadConfig(values.config);
  const { config, notes } = planWingsImport(wings, current, values.force);
  for (const note of notes) {
    console.log(`note: ${note}`);
  }

  const docker = new Docker(config.docker.socket);
  if (!(await docker.version())) {
    throw new Error(`cannot reach Docker at ${config.docker.socket}`);
  }
  const containers = await wingsContainers(docker);
  const running = containers.filter((c) => c.State === "running");
  if (running.length > 0 && !values["stop-running"]) {
    throw new Error(
      `${running.length} server(s) are still running under Wings: ${running.map(containerName).join(", ")}. ` +
        "Stop them from Pterodactyl first, or pass --stop-running to stop them with SIGTERM.",
    );
  }

  // 1. Wings itself, so it can't restart or recreate anything behind our back.
  const service = values["wings-service"];
  const [active, enabled] = [await systemctl("is-active", service), await systemctl("is-enabled", service)];
  if (active === null) {
    console.warn("systemctl not found: make sure Wings is stopped before starting the agent");
  } else if (active.out === "active" || enabled?.out === "enabled") {
    step(`stop and disable ${service}.service`);
    if (!dryRun) {
      const result = await systemctl("disable", "--now", service);
      if (result?.code !== 0) {
        throw new Error(`could not stop ${service}: ${result?.out ?? "unknown error"}`);
      }
    }
  }

  // 2. Wings' containers share names with the agent's (the server uuid), and
  //    the agent would otherwise adopt them with Wings' limits and network.
  for (const container of containers) {
    if (container.State === "running") {
      step(`stop ${containerName(container)}`);
      if (!dryRun) {
        await docker.stop(container.Id, 60);
      }
    }
    step(`remove Wings container ${containerName(container)}`);
    if (!dryRun) {
      await docker.remove(container.Id);
    }
  }

  // 3. Its network holds the subnet the agent's own network defaults to.
  const network = wings.docker?.network?.name ?? "pterodactyl_nw";
  const networkRes = await docker.request("GET", `/networks/${network}`, undefined, { allow404: true });
  if (networkRes.status !== 404) {
    step(`remove Docker network ${network}`);
    if (!dryRun) {
      await docker
        .request("DELETE", `/networks/${network}`)
        .catch((error) => console.warn(`could not remove ${network}: ${errorMessage(error)}`));
    }
  }

  // 4. Backups: both daemons store <backup uuid>.tar.gz, so a move is enough.
  const backupDir = wings.system.backup_directory;
  if (backupDir !== config.system.backups && existsSync(backupDir)) {
    const archives = (await readdir(backupDir)).filter((file) => file.endsWith(".tar.gz"));
    if (archives.length > 0) {
      step(`move ${archives.length} backup archive(s) from ${backupDir} to ${config.system.backups}`);
    }
    if (!dryRun) {
      await mkdir(config.system.backups, { recursive: true });
      for (const archive of archives) {
        const target = join(config.system.backups, archive);
        if (existsSync(target)) {
          console.warn(`skipping ${archive}: already in ${config.system.backups}`);
          continue;
        }
        await moveFile(join(backupDir, archive), target);
      }
    }
  }

  // 5. Reusing Wings' SFTP host key spares users a "host key changed" warning.
  const wingsKey = join(wings.system.root_directory, ".sftp", "id_ed25519");
  if (existsSync(config.sftp.hostKey)) {
    console.log(`keeping the agent's existing SFTP host key at ${config.sftp.hostKey}`);
  } else if (existsSync(wingsKey)) {
    const key = await readFile(wingsKey, "utf-8");
    if (ssh2.utils.parseKey(key) instanceof Error) {
      console.warn(`Wings' SFTP host key at ${wingsKey} could not be read; the agent will generate a new one`);
    } else {
      step(`reuse Wings' SFTP host key from ${wingsKey}`);
      if (!dryRun) {
        await mkdir(dirname(config.sftp.hostKey), { recursive: true });
        await writeFile(config.sftp.hostKey, key, { mode: 0o600 });
      }
    }
  }

  step(`write ${values.config}`);
  if (!dryRun) {
    await saveConfig(config, values.config);
  }

  console.log(
    dryRun
      ? "\nDry run: nothing was changed."
      : [
          "\nWings import complete. Start the agent with:",
          "  systemctl enable --now bytepanel-daemon",
          `Server files stay in ${config.system.data}. Once everything works you can remove`,
          `${values["wings-config"]}, the Wings binary and ${wings.system.root_directory}/{archives,.sftp}.`,
          "Running configure again resets these settings; re-run import-wings afterwards.",
        ].join("\n"),
  );
};
