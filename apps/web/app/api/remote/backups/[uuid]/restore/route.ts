import { restoreStatusSchema } from "@bytepanel/protocol";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { emitActivity } from "@/lib/events/emit";
import { parseJson, remoteHandler } from "@/lib/remote/handler";

export const runtime = "nodejs";

export const POST = remoteHandler<{ uuid: string }>(
  async ({ node, params, request }) => {
    const backup = await prisma.backup.findFirst({
      where: { server: { nodeId: node.id }, uuid: params.uuid },
    });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    const body = await parseJson(request, restoreStatusSchema);
    if ("response" in body) {
      return body.response;
    }
    await prisma.server.updateMany({
      data: { status: null },
      where: { id: backup.serverId, status: "restoring_backup" },
    });
    await emitActivity({
      message: body.data.successful
        ? `Restored backup "${backup.name}"`
        : `Restoring backup "${backup.name}" failed`,
      phase: body.data.successful
        ? "server:backup.restore-complete"
        : "server:backup.restore-failed",
      serverId: backup.serverId,
      source: "daemon",
    });
    return new NextResponse(null, { status: 204 });
  }
);
