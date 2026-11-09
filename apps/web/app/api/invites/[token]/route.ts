import { NextResponse } from "next/server";
import { ulid } from "ulid";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params;
  const user = await requireUser();

  const invite = await prisma.serverInvite.findUnique({ where: { token } });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json(
      { error: "Invite already accepted." },
      { status: 409 }
    );
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite has expired." }, { status: 410 });
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invite is for a different email address." },
      { status: 403 }
    );
  }

  const existing = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: invite.serverId, userId: user.id } },
  });
  if (existing) {
    await prisma.serverInvite.update({
      data: { acceptedAt: new Date() },
      where: { id: invite.id },
    });
    return NextResponse.json({ error: "Already a member." }, { status: 409 });
  }

  const [member] = await prisma.$transaction([
    prisma.serverMember.create({
      data: {
        id: ulid(),
        invitedById: invite.invitedById,
        role: invite.role,
        serverId: invite.serverId,
        userId: user.id,
      },
    }),
    prisma.serverInvite.update({
      data: { acceptedAt: new Date() },
      where: { id: invite.id },
    }),
  ]);

  return NextResponse.json(
    { member, serverId: invite.serverId },
    { status: 201 }
  );
};
