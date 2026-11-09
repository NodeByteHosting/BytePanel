export const POWER_STATES = [
  "offline",
  "starting",
  "running",
  "stopping",
] as const;
export type PowerState = (typeof POWER_STATES)[number];

export const POWER_ACTIONS = ["start", "stop", "restart", "kill"] as const;
export type PowerAction = (typeof POWER_ACTIONS)[number];

export const SERVER_STATUSES = [
  "installing",
  "install_failed",
  "reinstall_failed",
  "suspended",
  "restoring_backup",
] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

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

export const DEFAULT_SFTP_PORT = 2022;
export const SFTP_SERVER_ID_LENGTH = 8;

export const WEBSOCKET_TOKEN_TTL_SECONDS = 10 * 60;
export const TRANSFER_TOKEN_TTL_SECONDS = 15 * 60;

export const DEFAULT_MOUNT_PATH = "/home/container";
export const DEFAULT_INSTALL_CONTAINER =
  "ghcr.io/pterodactyl/installers:debian";

export const REDIS_KEYS = {
  activityChannel: (serverId: string) => `activity:${serverId}`,
  activitySeq: (serverId: string) => `activity-seq:${serverId}`,
  sftpAuthAttempts: (ip: string) => `sftp-auth:${ip}`,
} as const;
