import { NextResponse } from "next/server";

import { getRequestIp, logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const actor = await requireSuperAdmin();
  const actorId = (actor as { id?: string }).id ?? null;
  const actorEmail = (actor as { email?: string }).email ?? null;

  const session = await prisma.session.findUnique({
    select: { userId: true },
    where: { id },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await prisma.session.delete({ where: { id } });

  await logEvent({
    action: "admin.session.revoked",
    actorEmail,
    actorId,
    ipAddress: getRequestIp(req),
    metadata: { sessionId: id },
    targetId: session.userId,
    targetType: "user",
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
};
