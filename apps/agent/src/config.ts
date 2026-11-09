import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { z } from "zod";

import pkg from "../package.json";

declare const __AGENT_COMMIT__: string | undefined;

export const CONFIG_PATH =
  process.env.BYTEPANEL_CONFIG_PATH ?? "/etc/bytepanel/daemon.json";

export const VERSION = pkg.version;

export const COMMIT =
  typeof __AGENT_COMMIT__ === "string" && __AGENT_COMMIT__
    ? __AGENT_COMMIT__
    : null;

export const configSchema = z.object({
  allowedOrigins: z.array(z.string()).default([]),
  api: z
    .object({
      host: z.string().default("0.0.0.0"),
      port: z.number().int().min(1).max(65_535).default(8080),
      ssl: z
        .object({
          cert: z.string().default(""),
          enabled: z.boolean().default(false),
          key: z.string().default(""),
        })
        .default({ cert: "", enabled: false, key: "" }),
      uploadLimitMb: z.number().int().positive().default(100),
    })
    .default({
      host: "0.0.0.0",
      port: 8080,
      ssl: { cert: "", enabled: false, key: "" },
      uploadLimitMb: 100,
    }),
  docker: z
    .object({
      dns: z.array(z.string()).default(["1.1.1.1", "1.0.0.1"]),
      network: z
        .object({
          bridge: z.string().default("bytepanel0"),
          gateway: z.string().default("172.18.0.1"),
          name: z.string().default("bytepanel_nw"),
          subnet: z.string().default("172.18.0.0/16"),
        })
        .default({
          bridge: "bytepanel0",
          gateway: "172.18.0.1",
          name: "bytepanel_nw",
          subnet: "172.18.0.0/16",
        }),
      pidsLimit: z.number().int().positive().default(512),
      socket: z.string().default("/var/run/docker.sock"),
      tmpfsSizeMb: z.number().int().positive().default(100),
    })
    .default({
      dns: ["1.1.1.1", "1.0.0.1"],
      network: {
        bridge: "bytepanel0",
        gateway: "172.18.0.1",
        name: "bytepanel_nw",
        subnet: "172.18.0.0/16",
      },
      pidsLimit: 512,
      socket: "/var/run/docker.sock",
      tmpfsSizeMb: 100,
    }),
  remote: z.string().url(),
  system: z
    .object({
      backups: z.string().default("/var/lib/bytepanel/backups"),
      data: z.string().default("/var/lib/bytepanel/volumes"),
      diskCheckIntervalSeconds: z.number().int().positive().default(60),
      logs: z.string().default("/var/log/bytepanel"),
      state: z.string().default("/var/lib/bytepanel/state"),
      timezone: z.string().default("UTC"),
      tmp: z.string().default("/tmp/bytepanel"),
      user: z
        .object({
          gid: z.number().int().nonnegative().default(988),
          uid: z.number().int().nonnegative().default(988),
        })
        .default({ gid: 988, uid: 988 }),
    })
    .default({
      backups: "/var/lib/bytepanel/backups",
      data: "/var/lib/bytepanel/volumes",
      diskCheckIntervalSeconds: 60,
      logs: "/var/log/bytepanel",
      state: "/var/lib/bytepanel/state",
      timezone: "UTC",
      tmp: "/tmp/bytepanel",
      user: { gid: 988, uid: 988 },
    }),
  sftp: z
    .object({
      enabled: z.boolean().default(true),
      host: z.string().default("0.0.0.0"),
      hostKey: z.string().default(join(dirname(CONFIG_PATH), "ssh_host_ed25519_key")),
      port: z.number().int().min(1).max(65_535).default(2022),
    })
    .default({
      enabled: true,
      host: "0.0.0.0",
      hostKey: join(dirname(CONFIG_PATH), "ssh_host_ed25519_key"),
      port: 2022,
    }),
  token: z.string().min(32),
  tokenId: z.string().min(8),
  uuid: z.string().uuid(),
});

export type Config = z.infer<typeof configSchema>;

export const loadConfig = async (path = CONFIG_PATH): Promise<Config> => {
  if (!existsSync(path)) {
    throw new Error(
      `No configuration at ${path}. Run "bytepanel-daemon configure" or paste the config from the panel.`,
    );
  }
  return configSchema.parse(JSON.parse(await readFile(path, "utf-8")));
};

export const saveConfig = async (
  config: unknown,
  path = CONFIG_PATH,
): Promise<Config> => {
  const parsed = configSchema.parse(config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  return parsed;
};

export const ensureDirectories = async (config: Config): Promise<void> => {
  for (const dir of [
    config.system.data,
    config.system.backups,
    config.system.state,
    config.system.tmp,
    `${config.system.logs}/install`,
  ]) {
    await mkdir(dir, { recursive: true });
  }
};
