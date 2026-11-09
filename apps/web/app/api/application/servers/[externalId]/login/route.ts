import { NextResponse } from "next/server";

import {
  applicationHandler,
  billingActor,
  findExternalServer,
  serverNotFound,
} from "@/lib/application/handler";
import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { createLoginLink, LOGIN_LINK_SECONDS } from "@/lib/login-links";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

export const POST = applicationHandler<{ externalId: string }>(
  async ({ params }) => {
    const server = await findExternalServer(params.externalId);
    if (!server?.userId) {
      return serverNotFound();
    }
    const owner = await prisma.user.findUnique({
      select: { banned: true, role: true, superAdmin: true },
      where: { id: server.userId },
    });
    if (!owner || owner.banned || owner.role === "admin" || owner.superAdmin) {
      return NextResponse.json(
        { error: "This account must sign in with its password" },
        { status: 403 }
      );
    }
    const url = await createLoginLink(redis, {
      serverId: server.id,
      userId: server.userId,
    });
    await logEvent({
      action: "application.server.login_link",
      actorEmail: await billingActor(),
      targetId: server.id,
      targetType: "server",
    });
    return NextResponse.json({ expiresIn: LOGIN_LINK_SECONDS, url });
  }
);
