import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireServerRole } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

import { TeamPanel } from "../components/team-panel";

const TeamTab = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id: serverId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  // Only owners can access the team management page
  await requireServerRole(user.id, serverId, userRole, userSuperAdmin, "owner");

  const server = await prisma.server.findUnique({
    select: {
      id: true,
      invites: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          email: true,
          expiresAt: true,
          id: true,
          role: true,
          token: true,
        },
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      },
      members: {
        include: {
          user: { select: { email: true, id: true, image: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      user: { select: { email: true, id: true, image: true, name: true } },
    },
    where: { id: serverId },
  });

  if (!server) {
    notFound();
  }

  return (
    <TeamPanel
      currentUserId={user.id}
      invites={server.invites.map((inv) => ({
        ...inv,
        createdAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
      }))}
      members={server.members.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }))}
      owner={server.user}
      serverId={serverId}
    />
  );
};

export default TeamTab;
