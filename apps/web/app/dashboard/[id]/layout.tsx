import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { prisma } from "@/lib/db";
import { requireServerRole } from "@/lib/rbac";
import { meetsMinServerRole } from "@/lib/server-roles";
import type { ServerRole } from "@/lib/server-roles";
import { requireUser } from "@/lib/session";
import { sftpUsername } from "@/lib/sftp";

import { ServerShell } from "./components/shell";

const ServerLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) => {
  const user = await requireUser();
  const { id } = await params;

  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  const isSystemAdmin = userSuperAdmin || userRole === "admin";

  const serverRole: ServerRole = await requireServerRole(
    user.id,
    id,
    userRole,
    userSuperAdmin,
    "viewer"
  );

  const server = await prisma.server.findFirst({
    include: {
      allocations: { orderBy: { port: "asc" } },
      egg: { include: { variables: { orderBy: { sort: "asc" } } } },
      node: { include: { location: true } },
      plan: { select: { name: true } },
      variables: true,
    },
    where: { deletedAt: null, id },
  });

  if (!server) {
    notFound();
  }

  const variables = (server.egg?.variables ?? [])
    .filter((v) => v.userViewable || isSystemAdmin)
    .map((v) => ({
      defaultValue: v.defaultValue,
      description: v.description,
      editable: isSystemAdmin || v.userEditable,
      envVariable: v.envVariable,
      name: v.name,
      rules: v.rules,
      value:
        server.variables.find((sv) => sv.variableId === v.id)?.value ??
        v.defaultValue,
    }));

  return (
    <ServerShell
      serverRole={serverRole}
      server={{
        allocations: server.allocations.map((a) => ({
          alias: a.ipAlias,
          id: a.id,
          ip: a.ip,
          port: a.port,
          primary: a.id === server.allocationId,
        })),
        deployed: server.nodeId !== null,
        description: server.description,
        errorReason: server.errorReason,
        game: server.egg
          ? {
              dockerImages: server.egg.dockerImages as Record<string, string>,
              image: server.egg.image,
              name: server.egg.name,
              slug: server.egg.slug,
            }
          : null,
        id: server.id,
        image: server.image,
        limits: {
          allocationLimit: server.allocationLimit,
          backupLimit: server.backupLimit,
          cpu: server.cpu,
          disk: server.disk,
          memory: server.memory,
          swap: server.swap,
        },
        name: server.name,
        node: server.node
          ? {
              location: server.node.location.long ?? server.node.location.short,
              name: server.node.name,
            }
          : null,
        planName: server.plan?.name ?? null,
        sftp:
          server.node && meetsMinServerRole(serverRole, "admin")
            ? {
                host: server.node.fqdn,
                port: server.node.daemonSftp,
                username: sftpUsername(user.email, server.uuid),
              }
            : null,
        startup: server.startup,
        status: server.status,
        uuid: server.uuid,
        variables,
      }}
    >
      {children}
    </ServerShell>
  );
};

export default ServerLayout;
