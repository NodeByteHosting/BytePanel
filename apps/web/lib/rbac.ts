import "server-only";
import { notFound } from "next/navigation";

import { prisma } from "./db";
import type { ServerRole } from "./server-roles";
import { meetsMinServerRole } from "./server-roles";

export type { ServerRole } from "./server-roles";

export const getServerRole = async (
  userId: string,
  serverId: string,
  userSystemRole: string,
  userSuperAdmin: boolean
): Promise<ServerRole | null> => {
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

  if (userSuperAdmin || userSystemRole === "admin") {
    return "admin";
  }

  const membership = await prisma.serverMember.findUnique({
    select: { role: true },
    where: { serverId_userId: { serverId, userId } },
  });

  return (membership?.role as ServerRole | undefined) ?? null;
};

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

export const isAdmin = (role: string, superAdmin: boolean) =>
  superAdmin || role === "admin";

export const isSuperAdmin = (superAdmin: boolean) => superAdmin;

export {
  meetsMinServerRole,
  SERVER_ROLE_DESCRIPTIONS,
  SERVER_ROLE_LABELS,
} from "./server-roles";
