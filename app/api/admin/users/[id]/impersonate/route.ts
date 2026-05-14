import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getRequestIp, logEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// POST /api/admin/users/[id]/impersonate
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  // Must be admin or super-admin
  const actor = await requireAdmin();

  // Fetch target user — only allow impersonating plain users
  const target = await prisma.user.findUnique({
    select: { email: true, id: true, name: true, role: true, superAdmin: true },
    where: { id },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // RBAC: cannot impersonate admins or super-admins
  if (target.role === "admin" || target.superAdmin) {
    return NextResponse.json(
      { error: "Cannot impersonate admin users" },
      { status: 403 }
    );
  }

  const reqHeaders = await headers();

  // Use Better Auth admin plugin to create an impersonation session
  const actorEmail = (actor as { email?: string }).email ?? null;
  const actorId = (actor as { id?: string }).id ?? null;

  try {
    const session = await auth.api.impersonateUser({
      body: { userId: id },
      headers: reqHeaders,
    });

    await logEvent({
      action: "admin.user.impersonate",
      actorEmail,
      actorId,
      ipAddress: getRequestIp(req),
      metadata: {
        targetEmail: target.email,
        targetName: target.name,
      },
      targetId: id,
      targetType: "user",
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "Failed to start impersonation session" },
      { status: 500 }
    );
  }
};
