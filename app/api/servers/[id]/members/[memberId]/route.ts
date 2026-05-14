import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireServerRole } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  role: z.enum(["viewer", "member", "admin"]),
});

// PATCH /api/servers/[id]/members/[memberId] — change role
export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) => {
  const { id: serverId, memberId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  await requireServerRole(user.id, serverId, userRole, userSuperAdmin, "owner");

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const member = await prisma.serverMember.findUnique({
    where: { id: memberId },
  });
  if (!member || member.serverId !== serverId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const updated = await prisma.serverMember.update({
    data: { role: parsed.data.role },
    include: {
      user: { select: { email: true, id: true, image: true, name: true } },
    },
    where: { id: memberId },
  });

  return NextResponse.json({ member: updated });
};

// DELETE /api/servers/[id]/members/[memberId] — remove member
export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) => {
  const { id: serverId, memberId } = await params;
  const user = await requireUser();
  const userRole = (user as { role?: string }).role ?? "user";
  const userSuperAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;

  await requireServerRole(user.id, serverId, userRole, userSuperAdmin, "owner");

  const member = await prisma.serverMember.findUnique({
    where: { id: memberId },
  });
  if (!member || member.serverId !== serverId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // A user can also remove themselves (leave)
  await prisma.serverMember.delete({ where: { id: memberId } });

  return new NextResponse(null, { status: 204 });
};
