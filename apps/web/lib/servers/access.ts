import "server-only";
import type { Node, Server } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getServerRole, isAdmin } from "@/lib/rbac";
import type { ServerRole } from "@/lib/server-roles";
import { meetsMinServerRole } from "@/lib/server-roles";
import { getSession } from "@/lib/session";

export interface ServerAccess {
  user: { id: string; email: string; name: string };
  role: ServerRole;
  isSystemAdmin: boolean;
  server: Server & { node: Node | null };
}

export const getServerAccess = async (
  serverId: string,
  minRole: ServerRole = "viewer"
): Promise<ServerAccess | null> => {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }
  const { user } = session;
  const systemRole = (user as { role?: string }).role ?? "user";
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  const role = await getServerRole(user.id, serverId, systemRole, superAdmin);
  if (!role || !meetsMinServerRole(role, minRole)) {
    return null;
  }
  const server = await prisma.server.findFirst({
    include: { node: true },
    where: { deletedAt: null, id: serverId },
  });
  if (!server) {
    return null;
  }
  return {
    isSystemAdmin: isAdmin(systemRole, superAdmin),
    role,
    server,
    user: { email: user.email, id: user.id, name: user.name },
  };
};

export const requestIp = (headers: Headers): string | null =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  headers.get("x-real-ip") ??
  null;
