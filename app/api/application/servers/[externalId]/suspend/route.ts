import { NextResponse } from "next/server";

import {
  applicationHandler,
  billingActor,
  findExternalServer,
  serializeServer,
  serverNotFound,
} from "@/lib/application/handler";
import { logEvent } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { setSuspended } from "@/lib/servers/service";

export const runtime = "nodejs";

// POST suspends (overdue invoice); DELETE lifts the suspension once paid.
const toggle = (suspended: boolean) =>
  applicationHandler<{ externalId: string }>(async ({ params }) => {
    const server = await findExternalServer(params.externalId);
    if (!server) {
      return serverNotFound();
    }
    if ((server.status === "suspended") !== suspended) {
      await setSuspended(server.id, suspended);
      await logEvent({
        action: suspended
          ? "application.server.suspend"
          : "application.server.unsuspend",
        actorEmail: await billingActor(),
        targetId: server.id,
        targetType: "server",
      });
    }
    const updated = await prisma.server.findUniqueOrThrow({
      where: { id: server.id },
    });
    return NextResponse.json({ server: serializeServer(updated) });
  });

export const POST = toggle(true);
export const DELETE = toggle(false);
