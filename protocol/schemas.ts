import { z } from "zod";

import { DAEMON_PERMISSIONS, POWER_ACTIONS, POWER_STATES } from "./constants";

// ─── Panel → daemon: server configuration ────────────────────────────────────
// Served by the panel at GET /api/remote/servers/:uuid. Every placeholder
// (`{{SERVER_MEMORY}}`, `{{server.build.default.port}}`, …) is resolved by the
// panel before it is sent, so the daemon never needs to know about eggs.

export const configFileParserSchema = z.enum([
  "file",
  "properties",
  "json",
  "yaml",
  "ini",
]);
export type ConfigFileParser = z.infer<typeof configFileParserSchema>;

export const configFileSchema = z.object({
  file: z.string().min(1),
  parser: configFileParserSchema,
  replace: z.array(z.object({ match: z.string().min(1), value: z.string() })),
});
export type ConfigFile = z.infer<typeof configFileSchema>;

export const allocationMappingSchema = z.object({
  // Port inside the container. Equal to `port` unless the egg pins a fixed
  // container port (images that cannot change their listen port).
  containerPort: z.number().int().min(1).max(65_535),
  ip: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
});
export type AllocationMapping = z.infer<typeof allocationMappingSchema>;

export const serverConfigurationSchema = z.object({
  allocations: z.object({
    default: z.object({ ip: z.string(), port: z.number().int() }),
    mappings: z.array(allocationMappingSchema),
  }),
  // cpuLimit is a percentage of one core; diskSpace, memoryLimit and swap are
  // MiB. 0 means unlimited (-1 for swap).
  build: z.object({
    cpuLimit: z.number().int().nonnegative(),
    diskSpace: z.number().int().nonnegative(),
    ioWeight: z.number().int().min(10).max(1000),
    memoryLimit: z.number().int().nonnegative(),
    oomDisabled: z.boolean(),
    swap: z.number().int().min(-1),
    threads: z.string().nullable(),
  }),
  container: z.object({
    // Extra bind mounts of sub-directories of the server volume, for images
    // that expect data in more than one place (e.g. /config + /opt/game).
    extraMounts: z.array(
      z.object({ source: z.string().min(1), target: z.string().min(1) })
    ),
    image: z.string().min(1),
    mountPath: z.string().min(1),
    // "daemon": run as the node's unprivileged uid/gid (Pterodactyl yolks).
    // "image": keep the image's USER (images that drop privileges themselves).
    user: z.enum(["daemon", "image"]),
    // Owner the volume is chowned to when user = "image" (e.g. the image's
    // steam user). Null leaves ownership alone.
    volumeOwner: z
      .object({
        gid: z.number().int().nonnegative(),
        uid: z.number().int().nonnegative(),
      })
      .nullable(),
  }),
  environment: z.record(z.string(), z.string()),
  // Empty = use the image's own entrypoint/command.
  invocation: z.string(),
  // How `invocation` reaches the container:
  //  env   — only as the STARTUP env var (Pterodactyl yolks entrypoints eval it)
  //  args  — shell-split into Cmd, i.e. arguments to the image's entrypoint
  //  shell — run as `sh -c "<invocation>"`, replacing the entrypoint
  invocationMode: z.enum(["env", "args", "shell"]),
  name: z.string(),
  process: z.object({
    configs: z.array(configFileSchema),
    startup: z.object({
      done: z.array(z.string()),
      stripAnsi: z.boolean(),
    }),
    stop: z.object({
      type: z.enum(["command", "signal", "native"]),
      value: z.string(),
    }),
  }),
  skipEggScripts: z.boolean(),
  suspended: z.boolean(),
  uuid: z.string().uuid(),
});
export type ServerConfiguration = z.infer<typeof serverConfigurationSchema>;

export const serverConfigurationPageSchema = z.object({
  data: z.array(serverConfigurationSchema),
  nextPage: z.number().int().nullable(),
});
export type ServerConfigurationPage = z.infer<
  typeof serverConfigurationPageSchema
>;

export const installScriptSchema = z.object({
  containerImage: z.string().min(1),
  entrypoint: z.string().min(1),
  environment: z.record(z.string(), z.string()),
  script: z.string(),
});
export type InstallScript = z.infer<typeof installScriptSchema>;

// ─── Daemon → panel: callbacks ───────────────────────────────────────────────

export const installStatusSchema = z.object({
  reinstall: z.boolean(),
  successful: z.boolean(),
});
export type InstallStatus = z.infer<typeof installStatusSchema>;

export const backupStatusSchema = z.object({
  checksum: z.string().nullable(),
  size: z.number().int().nonnegative(),
  successful: z.boolean(),
});
export type BackupStatus = z.infer<typeof backupStatusSchema>;

export const restoreStatusSchema = z.object({ successful: z.boolean() });
export type RestoreStatus = z.infer<typeof restoreStatusSchema>;

export const daemonActivitySchema = z.object({
  event: z.string().min(1),
  ip: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  serverUuid: z.string().uuid(),
  timestamp: z.string().datetime(),
  userUuid: z.string().nullable().optional(),
});
export type DaemonActivity = z.infer<typeof daemonActivitySchema>;

export const daemonActivityBatchSchema = z.object({
  data: z.array(daemonActivitySchema).max(500),
});

// SFTP logins: the daemon forwards the credentials, the panel checks the
// account password and the user's role on the server.
export const sftpAuthRequestSchema = z.object({
  ip: z.string().nullable(),
  password: z.string().min(1).max(1024),
  username: z.string().min(1).max(320),
});
export type SftpAuthRequest = z.infer<typeof sftpAuthRequestSchema>;

export const sftpAuthResponseSchema = z.object({
  serverUuid: z.string().uuid(),
  userUuid: z.string().min(1),
});
export type SftpAuthResponse = z.infer<typeof sftpAuthResponseSchema>;

// ─── Panel → daemon: HTTP API bodies ─────────────────────────────────────────

export const createServerRequestSchema = z.object({
  startOnCompletion: z.boolean().default(false),
  uuid: z.string().uuid(),
});
export type CreateServerRequest = z.infer<typeof createServerRequestSchema>;

export const powerRequestSchema = z.object({ action: z.enum(POWER_ACTIONS) });
export type PowerRequest = z.infer<typeof powerRequestSchema>;

export const commandsRequestSchema = z.object({
  commands: z.array(z.string().min(1).max(2048)).min(1).max(50),
});
export type CommandsRequest = z.infer<typeof commandsRequestSchema>;

export const filesDeleteRequestSchema = z.object({
  files: z.array(z.string().min(1)).min(1),
  root: z.string(),
});
export const filesRenameRequestSchema = z.object({
  files: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })),
  root: z.string(),
});
export const filesCreateDirectoryRequestSchema = z.object({
  name: z.string().min(1),
  path: z.string(),
});
export const filesPullRequestSchema = z.object({
  directory: z.string(),
  filename: z.string().min(1).optional(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/iu)
    .optional(),
  url: z.string().url(),
});
export const filesCompressRequestSchema = z.object({
  files: z.array(z.string().min(1)).min(1),
  root: z.string(),
});
export const filesDecompressRequestSchema = z.object({
  file: z.string().min(1),
  root: z.string(),
});

export const backupCreateRequestSchema = z.object({
  ignore: z.string().default(""),
  uuid: z.string().uuid(),
});
export const backupRestoreRequestSchema = z.object({
  truncateDirectory: z.boolean().default(false),
});

// ─── Daemon → panel: HTTP API responses ──────────────────────────────────────

export const fileEntrySchema = z.object({
  mime: z.string().optional(),
  mode: z.string().optional(),
  mtime: z.string().datetime(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  type: z.enum(["file", "dir", "symlink"]),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;

export const filesListResultSchema = z.object({
  entries: z.array(fileEntrySchema),
  path: z.string(),
});
export type FilesListResult = z.infer<typeof filesListResultSchema>;

export const resourceUsageSchema = z.object({
  cpuAbsolute: z.number().nonnegative(),
  diskBytes: z.number().int().nonnegative(),
  memoryBytes: z.number().int().nonnegative(),
  memoryLimitBytes: z.number().int().nonnegative(),
  network: z.object({
    rxBytes: z.number().int().nonnegative(),
    txBytes: z.number().int().nonnegative(),
  }),
  state: z.enum(POWER_STATES),
  uptimeMs: z.number().int().nonnegative(),
});
export type ResourceUsage = z.infer<typeof resourceUsageSchema>;

export const daemonServerDetailsSchema = z.object({
  isInstalling: z.boolean(),
  isSuspended: z.boolean(),
  utilization: resourceUsageSchema,
  uuid: z.string().uuid(),
});
export type DaemonServerDetails = z.infer<typeof daemonServerDetailsSchema>;

export const systemInfoSchema = z.object({
  architecture: z.string(),
  cpuCount: z.number().int(),
  dockerVersion: z.string().nullable(),
  kernelVersion: z.string(),
  os: z.string(),
  version: z.string(),
});
export type SystemInfo = z.infer<typeof systemInfoSchema>;

// ─── JWTs issued by the panel, verified by the daemon ───────────────────────
// Signed HS256 with the node's daemon token as the key.

export const websocketClaimsSchema = z.object({
  permissions: z.array(z.enum(DAEMON_PERMISSIONS)),
  serverUuid: z.string().uuid(),
  userUuid: z.string().min(1),
});
export type WebsocketClaims = z.infer<typeof websocketClaimsSchema>;

export const fileTransferClaimsSchema = z.object({
  // download: `path` is a file to stream back. upload: `path` is the target
  // directory. backup: `path` is the backup uuid.
  kind: z.enum(["download", "upload", "backup"]),
  path: z.string(),
  serverUuid: z.string().uuid(),
  userUuid: z.string().min(1),
});
export type FileTransferClaims = z.infer<typeof fileTransferClaimsSchema>;

// Websocket frames, both directions: { event, args? }
export const wsFrameSchema = z.object({
  args: z.array(z.string()).optional(),
  event: z.string().min(1),
});
export type WsFrame = z.infer<typeof wsFrameSchema>;
