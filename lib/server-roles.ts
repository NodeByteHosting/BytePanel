export type ServerRole = "viewer" | "member" | "admin" | "owner";

export const SERVER_ROLE_ORDER: Record<ServerRole, number> = {
  admin: 2,
  member: 1,
  owner: 3,
  viewer: 0,
};

export const meetsMinServerRole = (
  actual: ServerRole,
  required: ServerRole
): boolean => SERVER_ROLE_ORDER[actual] >= SERVER_ROLE_ORDER[required];

export const SERVER_ROLE_LABELS: Record<ServerRole, string> = {
  admin: "Admin",
  member: "Member",
  owner: "Owner",
  viewer: "Viewer",
};

export const SERVER_ROLE_DESCRIPTIONS: Record<ServerRole, string> = {
  admin: "Can manage settings, files, and backups",
  member: "Can view and start/stop the server",
  owner: "Full control including team management",
  viewer: "Read-only: console, graphs, and activity",
};