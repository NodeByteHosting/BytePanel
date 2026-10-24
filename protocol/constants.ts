// Shared constants for the panel <-> daemon contract. The design mirrors
// Pterodactyl Panel + Wings: the panel owns configuration and permissions, the
// daemon (one per node) owns containers, files and the live console.

export const POWER_STATES = [
  "offline",
  "starting",
  "running",
  "stopping",
] as const;
export type PowerState = (typeof POWER_STATES)[number];

export const POWER_ACTIONS = ["start", "stop", "restart", "kill"] as const;
export type PowerAction = (typeof POWER_ACTIONS)[number];

// Panel-side lifecycle of a server record. `null` in the database means the
// server is installed and usable.
export const SERVER_STATUSES = [
  "installing",
  "install_failed",
  "reinstall_failed",
  "suspended",
  "restoring_backup",
] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

// Permissions embedded in the websocket / transfer JWTs the panel issues and
// the daemon enforces.
export const DAEMON_PERMISSIONS = [
  "websocket.connect",
  "control.console",
  "control.start",
  "control.stop",
  "control.restart",
  "admin.websocket.errors",
  "admin.websocket.install",
] as const;
export type DaemonPermission = (typeof DAEMON_PERMISSIONS)[number];

// Websocket event names (same vocabulary as Wings so clients feel familiar).
export const WS_EVENTS = {
  AUTH: "auth",
  AUTH_SUCCESS: "auth success",
  BACKUP_COMPLETED: "backup completed",
  CONSOLE_OUTPUT: "console output",
  DAEMON_ERROR: "daemon error",
  DAEMON_MESSAGE: "daemon message",
  INSTALL_COMPLETED: "install completed",
  INSTALL_OUTPUT: "install output",
  INSTALL_STARTED: "install started",
  JWT_ERROR: "jwt error",
  SEND_COMMAND: "send command",
  SEND_LOGS: "send logs",
  SEND_STATS: "send stats",
  SET_STATE: "set state",
  STATS: "stats",
  STATUS: "status",
  TOKEN_EXPIRED: "token expired",
  TOKEN_EXPIRING: "token expiring",
} as const;

export const DAEMON_TOKEN_ID_LENGTH = 16;
export const DAEMON_TOKEN_LENGTH = 64;

export const WEBSOCKET_TOKEN_TTL_SECONDS = 10 * 60;
export const TRANSFER_TOKEN_TTL_SECONDS = 15 * 60;

// Default mount point inside game containers (Pterodactyl convention).
export const DEFAULT_MOUNT_PATH = "/home/container";
export const DEFAULT_INSTALL_CONTAINER =
  "ghcr.io/pterodactyl/installers:debian";

export const REDIS_KEYS = {
  activityChannel: (serverId: string) => `activity:${serverId}`,
  activitySeq: (serverId: string) => `activity-seq:${serverId}`,
} as const;
