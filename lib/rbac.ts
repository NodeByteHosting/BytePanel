/**
 * RBAC helpers for NodeByte panel.
 *
 * Two layers of access control:
 *  1. System roles  — `role` field on User: "user" | "admin"; plus `superAdmin` boolean.
 *  2. Server roles  — `ServerMember.role`: "viewer" | "member" | "admin"; server owner has implicit "owner".
 */
import "server-only";
import { notFound } from "next/navigation";

import { prisma } from "./db";

// ─── Server-level roles ────────────────────────────────────────────────────────

export type ServerRole = "viewer" | "member" | "admin" | "owner";

const SERVER_ROLE_ORDER: Record<ServerRole, number> = {
  admin: 2,
  member: 1,
  owner: 3,
  viewer: 0,
};

/**
 * Returns true if `actual` meets or exceeds `required` in the role hierarchy.
 */
export const meetsMinServerRole = (
  actual: ServerRole,
  required: ServerRole
): boolean => SERVER_ROLE_ORDER[actual] >= SERVER_ROLE_ORDER[required];

/**
 * Determine a user's effective role on a server.
 *
 * Resolution order:
 *  1. System admin / super-admin  → treated as "admin" on every server
 *  2. Server owner (userId === server.userId)  → "owner"
 *  3. Explicit ServerMember row  → that member's role
 *  4. Otherwise  → null (no access)
 */
export const getServerRole = async (
  userId: string,
  serverId: string,
  userSystemRole: string,
  userSuperAdmin: boolean
): Promise<ServerRole | null> => {
  // System admins can read/manage every server
  if (userSuperAdmin || userSystemRole === "admin") {
    return "admin";
  }

  const server = await prisma.server.findFirst({
    select: { userId: true },
    where: { deletedAt: null, id: serverId },
  });

  if (!server) {
    return null;
  }
  if (server.userId === userId) {
    return "owner";
  }

  const membership = await prisma.serverMember.findUnique({
    select: { role: true },
    where: { serverId_userId: { serverId, userId } },
  });

  return (membership?.role as ServerRole | undefined) ?? null;
};

/**
 * Require that the current user has at least `minRole` on `serverId`.
 * Returns the effective ServerRole on success; calls `notFound()` if not.
 */
export const requireServerRole = async (
  userId: string,
  serverId: string,
  userSystemRole: string,
  userSuperAdmin: boolean,
  minRole: ServerRole = "viewer"
): Promise<ServerRole> => {
  const role = await getServerRole(
    userId,
    serverId,
    userSystemRole,
    userSuperAdmin
  );

  if (!role || !meetsMinServerRole(role, minRole)) {
    notFound();
  }

  return role;
};

// ─── System role helpers ───────────────────────────────────────────────────────

export const isAdmin = (role: string, superAdmin: boolean) =>
  superAdmin || role === "admin";

export const isSuperAdmin = (superAdmin: boolean) => superAdmin;

// Human-readable labels for server roles
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
