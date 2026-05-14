import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireServerRole } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

// DELETE /api/servers/[id]/invites/[inviteId] — revoke a pending invite
export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) => {
  const { id: serverId, inviteId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  await requireServerRole(user.id, serverId, userRole, userSuperAdmin, "owner");

  const invite = await prisma.serverInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.serverId !== serverId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.serverInvite.delete({ where: { id: inviteId } });

  return new NextResponse(null, { status: 204 });
};
